"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/nav";
import { formatDate, daysAgo } from "@/lib/utils";

interface Session {
  id: string;
  date: string;
  sessionType: string;
  notes: string | null;
  illnessFlag: boolean;
  tags: string;
  exercises: Array<{
    displayNameUsed: string;
    sets: Array<{ weight: number | null; reps: number | null }>;
    exercise: { primaryBucket: { name: string } };
  }>;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions?limit=100")
      .then(r => r.json())
      .then(s => { setSessions(s); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-pulse text-[var(--muted-foreground)]">Loading...</div>
      </div>
    );
  }

  // Group by month
  const grouped = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = new Date(s.date).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <h1 className="mb-4 text-2xl font-bold">History</h1>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-[var(--muted-foreground)]">
            No sessions yet. Start a workout to see your history.
          </CardContent>
        </Card>
      ) : (
        Array.from(grouped.entries()).map(([month, monthSessions]) => (
          <div key={month} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-[var(--muted-foreground)]">{month}</h2>
            <div className="space-y-2">
              {monthSessions.map(session => {
                const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
                const totalVolume = session.exercises.reduce((a, e) =>
                  a + e.sets.reduce((v, s) => v + ((s.weight || 0) * (s.reps || 0)), 0), 0);
                const tags = JSON.parse(session.tags || "[]") as string[];

                return (
                  <Link key={session.id} href={`/history/${session.id}`}>
                    <Card className="transition-colors hover:bg-[var(--accent)]">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{formatDate(session.date)}</span>
                              {session.illnessFlag && <Badge variant="destructive" className="text-[10px]">sick</Badge>}
                              {tags.map((t, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] capitalize">{t.replace(/_/g, " ")}</Badge>
                              ))}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {session.exercises.map((ex, i) => (
                                <span key={i} className="text-xs text-[var(--muted-foreground)] capitalize">
                                  {ex.displayNameUsed}{i < session.exercises.length - 1 ? "," : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="ml-3 text-right text-xs text-[var(--muted-foreground)]">
                            <div>{totalSets} sets</div>
                            <div>{(totalVolume / 1000).toFixed(1)}k lb</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}

      <BottomNav />
    </div>
  );
}
