import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || "default-user";
  const days = parseInt(url.searchParams.get("days") || "90");
  const since = new Date();
  since.setDate(since.getDate() - days);

  const entries = await prisma.bodyweightEntry.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const entry = await prisma.bodyweightEntry.create({
    data: {
      userId: body.userId || "default-user",
      date: new Date(body.date || new Date()),
      weight: parseFloat(body.weight),
      note: body.note || null,
    },
  });
  return NextResponse.json(entry, { status: 201 });
}
