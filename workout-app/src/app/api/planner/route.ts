import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

interface BucketRecency {
  bucket: string;
  lastTrainedDaysAgo: number;
  totalSetsLast7d: number;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = body.userId || "default-user";
  const context = body.context || {};
  // context: { lowEnergy?: boolean, sick?: boolean, shortOnTime?: boolean, timeMinutes?: number }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Get recent sessions
  const recentSessions = await prisma.workoutSession.findMany({
    where: { userId, date: { gte: fourteenDaysAgo } },
    include: {
      exercises: {
        include: { exercise: { include: { primaryBucket: true } }, sets: true },
      },
    },
    orderBy: { date: "desc" },
  });

  // Get recent context
  const recentContext = await prisma.contextEvent.findMany({
    where: { userId, date: { gte: sevenDaysAgo } },
    orderBy: { date: "desc" },
  });

  // Compute bucket recency
  const bucketMap: Record<string, BucketRecency> = {};
  const allBuckets = await prisma.movementBucket.findMany();

  for (const b of allBuckets) {
    bucketMap[b.name] = { bucket: b.name, lastTrainedDaysAgo: 999, totalSetsLast7d: 0 };
  }

  const now = new Date();
  for (const session of recentSessions) {
    const daysAgo = Math.floor((now.getTime() - session.date.getTime()) / (1000 * 60 * 60 * 24));
    for (const ex of session.exercises) {
      const bn = ex.exercise.primaryBucket.name;
      if (bucketMap[bn]) {
        if (daysAgo < bucketMap[bn].lastTrainedDaysAgo) {
          bucketMap[bn].lastTrainedDaysAgo = daysAgo;
        }
        if (daysAgo <= 7) {
          bucketMap[bn].totalSetsLast7d += ex.sets.length;
        }
      }
    }
  }

  // Check for illness/recovery
  const isSick = context.sick || recentContext.some(c => c.type === "illness" && Math.floor((now.getTime() - c.date.getTime()) / (1000*60*60*24)) <= 2);
  const isLowEnergy = context.lowEnergy || recentContext.some(c => c.type === "low_energy" && Math.floor((now.getTime() - c.date.getTime()) / (1000*60*60*24)) <= 1);
  const isShortTime = context.shortOnTime;
  const daysSinceLastSession = recentSessions.length > 0 ? Math.floor((now.getTime() - recentSessions[0].date.getTime()) / (1000*60*60*24)) : 999;

  // Generate suggestion
  let sessionType = "strength";
  let explanation = "";
  const suggestedExercises: Array<{ exerciseName: string; bucket: string; sets: number; reps: string; notes?: string }> = [];

  if (isSick) {
    sessionType = "recovery";
    explanation = "You've been sick recently. Light recovery or rest recommended.";
    suggestedExercises.push(
      { exerciseName: "walking", bucket: "run_cardio", sets: 1, reps: "20-30 min" },
      { exerciseName: "stretching", bucket: "recovery", sets: 1, reps: "10-15 min" },
    );
  } else if (daysSinceLastSession >= 7) {
    sessionType = "reentry";
    explanation = `It's been ${daysSinceLastSession} days since your last session. Starting with a lighter full-body workout to ease back in.`;
    // Pick one from each major group at reduced volume
    const priorities = ["chest_press", "row", "squat", "vertical_press"];
    for (const bucket of priorities) {
      const exercises = await prisma.exercise.findMany({
        where: { primaryBucket: { name: bucket } },
        take: 1,
      });
      if (exercises[0]) {
        suggestedExercises.push({
          exerciseName: exercises[0].canonicalName,
          bucket,
          sets: 2,
          reps: "8-10",
          notes: "Light weight, focus on form",
        });
      }
    }
  } else if (isLowEnergy || isShortTime) {
    sessionType = "light";
    explanation = isLowEnergy ? "Low energy noted. Shorter session with moderate intensity." : "Short on time. Compact but effective.";
    // Find least recently trained buckets
    const sorted = Object.values(bucketMap)
      .filter(b => !["recovery", "run_cardio", "abs_core"].includes(b.bucket))
      .sort((a, b) => b.lastTrainedDaysAgo - a.lastTrainedDaysAgo);
    const topBuckets = sorted.slice(0, 3);
    for (const b of topBuckets) {
      const exercises = await prisma.exercise.findMany({
        where: { primaryBucket: { name: b.bucket } },
        take: 1,
      });
      if (exercises[0]) {
        suggestedExercises.push({
          exerciseName: exercises[0].canonicalName,
          bucket: b.bucket,
          sets: 3,
          reps: "8-12",
        });
      }
    }
  } else {
    // Normal session - find least recently trained buckets
    const sorted = Object.values(bucketMap)
      .filter(b => !["recovery"].includes(b.bucket))
      .sort((a, b) => b.lastTrainedDaysAgo - a.lastTrainedDaysAgo);

    // Pick top 4-5 buckets
    const topBuckets = sorted.slice(0, 5);
    explanation = `Focusing on: ${topBuckets.map(b => b.bucket.replace(/_/g, " ")).join(", ")}. These haven't been trained recently.`;

    for (const b of topBuckets) {
      const exercises = await prisma.exercise.findMany({
        where: { primaryBucket: { name: b.bucket } },
        take: 2,
      });
      if (exercises[0]) {
        suggestedExercises.push({
          exerciseName: exercises[0].canonicalName,
          bucket: b.bucket,
          sets: 4,
          reps: "6-10",
        });
      }
    }
  }

  return NextResponse.json({
    sessionType,
    explanation,
    suggestedExercises,
    recentContext: recentContext.slice(0, 5),
    daysSinceLastSession,
    bucketRecency: Object.values(bucketMap),
  });
}
