"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/nav";
import { formatDate, daysAgo } from "@/lib/utils";
import { Dumbbell, Scale, TrendingUp, Upload, Zap, AlertTriangle } from "lucide-react";

interface SessionSummary {
  id: string;
  date: string;
  sessionType: string;
  exercises: Array<{ displayNameUsed: string; sets: Array<unknown> }>;
}

interface BodyweightEntry {
  date: string;
  weight: number;
}

interface ContextEvent {
  date: string;
  type: string;
  note: string | null;
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [bodyweight, setBodyweight] = useState<BodyweightEntry[]>([]);
  const [context, setContext] = useState<ContextEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/sessions?limit=10").then(r => r.json()),
      fetch("/api/bodyweight?days=30").then(r => r.json()),
      fetch("/api/context?days=14").then(r => r.json()),
    ]).then(([s, b, c]) => {
      setSessions(s);
      setBodyweight(b);
      setContext(c);
      setLoading(false);
    });
  }, []);

  const latestBW = bodyweight.length > 0 ? bodyweight[bodyweight.length - 1] : null;
  const prevBW = bodyweight.length > 1 ? bodyweight[bodyweight.length - 2] : null;
  const bwTrend = latestBW && prevBW ? latestBW.weight - prevBW.weight : 0;

  // Streak: consecutive weeks with at least one session
  const sessionsLast7 = sessions.filter(s => daysAgo(s.date) <= 7).length;
  const sessionsLast14 = sessions.filter(s => daysAgo(s.date) <= 14).length;

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-pulse text-[var(--muted-foreground)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Workout Tracker</h1>
        <p className="text-sm text-[var(--muted-foreground)]">{dateStr}</p>
      </div>

      {/* Context alerts */}
      {context.length > 0 && (
        <div className="mb-4 space-y-2">
          {context.slice(0, 3).map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-[var(--chart-5)]" />
              <span className="capitalize">{c.type.replace(/_/g, " ")}</span>
              {c.note && <span className="text-[var(--muted-foreground)]">— {c.note}</span>}
              <span className="ml-auto text-xs text-[var(--muted-foreground)]">{daysAgo(c.date) === 0 ? "Today" : `${daysAgo(c.date)}d ago`}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quick stats */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{sessionsLast7}</div>
            <div className="text-xs text-[var(--muted-foreground)]">This week</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{latestBW ? latestBW.weight : "—"}</div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {latestBW ? `${bwTrend > 0 ? "+" : ""}${bwTrend.toFixed(1)} lb` : "No data"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{sessionsLast14}</div>
            <div className="text-xs text-[var(--muted-foreground)]">Last 14d</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Link href="/workout">
          <Button variant="default" size="lg" className="w-full gap-2">
            <Dumbbell className="h-5 w-5" /> Start Workout
          </Button>
        </Link>
        <Link href="/planner">
          <Button variant="secondary" size="lg" className="w-full gap-2">
            <Zap className="h-5 w-5" /> Plan Today
          </Button>
        </Link>
        <Link href="/progress">
          <Button variant="outline" size="lg" className="w-full gap-2">
            <TrendingUp className="h-5 w-5" /> Progress
          </Button>
        </Link>
        <Link href="/import">
          <Button variant="outline" size="lg" className="w-full gap-2">
            <Upload className="h-5 w-5" /> Import
          </Button>
        </Link>
      </div>

      {/* Recent sessions */}
      <h2 className="mb-3 text-lg font-semibold">Recent Sessions</h2>
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-[var(--muted-foreground)]">
            No workouts yet. Start your first session!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.slice(0, 5).map((session) => (
            <Link key={session.id} href={`/history/${session.id}`}>
              <Card className="transition-colors hover:bg-[var(--accent)]">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{formatDate(session.date)}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {session.exercises.slice(0, 3).map((ex, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {ex.displayNameUsed}
                          </Badge>
                        ))}
                        {session.exercises.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{session.exercises.length - 3}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--muted-foreground)]">
                      <div>{session.exercises.reduce((a, e) => a + e.sets.length, 0)} sets</div>
                      <div>{daysAgo(session.date)}d ago</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
