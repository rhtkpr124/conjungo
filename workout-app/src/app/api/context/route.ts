import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || "default-user";
  const days = parseInt(url.searchParams.get("days") || "30");
  const since = new Date();
  since.setDate(since.getDate() - days);

  const events = await prisma.contextEvent.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const event = await prisma.contextEvent.create({
    data: {
      userId: body.userId || "default-user",
      date: new Date(body.date || new Date()),
      type: body.type,
      value: body.value || null,
      note: body.note || null,
    },
  });
  return NextResponse.json(event, { status: 201 });
}
