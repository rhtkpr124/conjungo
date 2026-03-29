import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || "default-user";
  const days = parseInt(url.searchParams.get("days") || "90");
  const exerciseId = url.searchParams.get("exerciseId");
  const bucketId = url.searchParams.get("bucketId");

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Build where clause for session exercises
  const exerciseWhere: Record<string, unknown> = {};
  if (exerciseId) exerciseWhere.exerciseId = exerciseId;
  if (bucketId) exerciseWhere.exercise = { primaryBucketId: bucketId };

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      date: { gte: since },
    },
    include: {
      exercises: {
        where: Object.keys(exerciseWhere).length > 0 ? exerciseWhere : undefined,
        include: {
          sets: true,
          exercise: { include: { primaryBucket: true } },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  // Compute progress metrics
  const exerciseProgress: Record<string, {
    exerciseId: string;
    name: string;
    bucketName: string;
    dataPoints: Array<{
      date: string;
      bestWeight: number;
      bestReps: number;
      totalVolume: number;
      estimatedE1RM: number;
      totalSets: number;
    }>;
  }> = {};

  for (const session of sessions) {
    for (const se of session.exercises) {
      const key = se.exerciseId;
      if (!exerciseProgress[key]) {
        exerciseProgress[key] = {
          exerciseId: se.exerciseId,
          name: se.exercise.canonicalName,
          bucketName: se.exercise.primaryBucket.name,
          dataPoints: [],
        };
      }

      let bestWeight = 0;
      let bestReps = 0;
      let totalVolume = 0;
      let bestE1RM = 0;

      for (const set of se.sets) {
        const w = set.weight || 0;
        const r = set.reps || 0;
        totalVolume += w * r;
        if (w > bestWeight) {
          bestWeight = w;
          bestReps = r;
        }
        const e1rm = r === 1 ? w : Math.round(w * (1 + r / 30));
        if (e1rm > bestE1RM) bestE1RM = e1rm;
      }

      exerciseProgress[key].dataPoints.push({
        date: session.date.toISOString().split("T")[0],
        bestWeight,
        bestReps,
        totalVolume,
        estimatedE1RM: bestE1RM,
        totalSets: se.sets.length,
      });
    }
  }

  // Bucket aggregation
  const bucketProgress: Record<string, {
    bucketId: string;
    bucketName: string;
    dataPoints: Array<{
      date: string;
      normalizedScore: number;
      totalVolume: number;
      totalSets: number;
    }>;
    exercises: string[];
  }> = {};

  for (const ep of Object.values(exerciseProgress)) {
    const bn = ep.bucketName;
    if (!bucketProgress[bn]) {
      bucketProgress[bn] = {
        bucketId: bn,
        bucketName: bn,
        dataPoints: [],
        exercises: [],
      };
    }
    if (!bucketProgress[bn].exercises.includes(ep.name)) {
      bucketProgress[bn].exercises.push(ep.name);
    }
    for (const dp of ep.dataPoints) {
      bucketProgress[bn].dataPoints.push({
        date: dp.date,
        normalizedScore: dp.estimatedE1RM,
        totalVolume: dp.totalVolume,
        totalSets: dp.totalSets,
      });
    }
  }

  // Session summary stats
  const sessionCount = sessions.length;
  const totalSets = sessions.reduce((acc, s) => acc + s.exercises.reduce((a, e) => a + e.sets.length, 0), 0);
  const totalVolume = sessions.reduce((acc, s) => acc + s.exercises.reduce((a, e) => a + e.sets.reduce((v, set) => v + (set.weight || 0) * (set.reps || 0), 0), 0), 0);

  return NextResponse.json({
    exerciseProgress: Object.values(exerciseProgress),
    bucketProgress: Object.values(bucketProgress),
    summary: { sessionCount, totalSets, totalVolume, days },
  });
}
