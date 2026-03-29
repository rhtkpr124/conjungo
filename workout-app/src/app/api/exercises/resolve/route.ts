import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  const lower = name.toLowerCase().trim();

  // Try exact canonical match
  let exercise = await prisma.exercise.findFirst({
    where: { canonicalName: lower },
    include: { aliases: true, primaryBucket: true },
  });
  if (exercise) return NextResponse.json(exercise);

  // Try alias match
  const alias = await prisma.exerciseAlias.findFirst({
    where: { alias: lower },
    include: { exercise: { include: { aliases: true, primaryBucket: true } } },
  });
  if (alias) return NextResponse.json(alias.exercise);

  // Try fuzzy match - contains
  exercise = await prisma.exercise.findFirst({
    where: { canonicalName: { contains: lower } },
    include: { aliases: true, primaryBucket: true },
  });
  if (exercise) return NextResponse.json(exercise);

  // Not found
  return NextResponse.json(null);
}
