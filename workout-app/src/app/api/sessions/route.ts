import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || "default-user";
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const sessions = await prisma.workoutSession.findMany({
    where: { userId },
    include: {
      exercises: {
        include: { sets: true, exercise: true },
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { date: "desc" },
    take: limit,
    skip: offset,
  });

  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    userId = "default-user",
    date,
    sessionType = "strength",
    notes,
    sleepHours,
    energyRating,
    illnessFlag,
    sorenessRating,
    tags = [],
    exercises = [],
  } = body;

  const session = await prisma.workoutSession.create({
    data: {
      userId,
      date: new Date(date || new Date()),
      sessionType,
      notes,
      sleepHours: sleepHours ? parseFloat(sleepHours) : null,
      energyRating: energyRating ? parseInt(energyRating) : null,
      sorenessRating: sorenessRating ? parseInt(sorenessRating) : null,
      illnessFlag: illnessFlag || false,
      tags: JSON.stringify(tags),
      exercises: {
        create: exercises.map((ex: { exerciseId: string; displayNameUsed: string; orderIndex: number; notes?: string; sets: Array<{ setIndex: number; setType?: string; weight?: number; reps?: number; rpe?: number; bodyweightAtTime?: number; totalLoad?: number; notes?: string }> }) => ({
          exerciseId: ex.exerciseId,
          displayNameUsed: ex.displayNameUsed,
          orderIndex: ex.orderIndex,
          notes: ex.notes || null,
          sets: {
            create: ex.sets.map((s) => ({
              setIndex: s.setIndex,
              setType: s.setType || "working",
              weight: s.weight ?? null,
              reps: s.reps ?? null,
              rpe: s.rpe ?? null,
              bodyweightAtTime: s.bodyweightAtTime ?? null,
              totalLoad: s.totalLoad ?? null,
              notes: s.notes || null,
            })),
          },
        })),
      },
    },
    include: {
      exercises: {
        include: { sets: true, exercise: true },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  return NextResponse.json(session, { status: 201 });
}
