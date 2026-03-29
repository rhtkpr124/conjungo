import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const exercises = await prisma.exercise.findMany({
    include: { aliases: true, primaryBucket: true },
    orderBy: { canonicalName: "asc" },
  });
  return NextResponse.json(exercises);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const exercise = await prisma.exercise.create({
    data: {
      canonicalName: body.canonicalName,
      primaryBucketId: body.primaryBucketId,
      equipmentType: body.equipmentType || "barbell",
      comparisonMode: body.comparisonMode || "weight",
      normalizationFactor: body.normalizationFactor || 1.0,
      isBodyweightRelevant: body.isBodyweightRelevant || false,
      aliases: body.aliases ? {
        create: body.aliases.map((a: string) => ({ alias: a })),
      } : undefined,
    },
    include: { aliases: true, primaryBucket: true },
  });
  return NextResponse.json(exercise, { status: 201 });
}
