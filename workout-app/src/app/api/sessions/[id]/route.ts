import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.workoutSession.findUnique({
    where: { id },
    include: {
      exercises: {
        include: { sets: true, exercise: true },
        orderBy: { orderIndex: "asc" },
      },
    },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const session = await prisma.workoutSession.update({
    where: { id },
    data: {
      notes: body.notes,
      sessionType: body.sessionType,
      sleepHours: body.sleepHours,
      energyRating: body.energyRating,
      sorenessRating: body.sorenessRating,
      illnessFlag: body.illnessFlag,
      endedAt: body.endedAt ? new Date(body.endedAt) : undefined,
      tags: body.tags ? JSON.stringify(body.tags) : undefined,
    },
  });
  return NextResponse.json(session);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.workoutSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
