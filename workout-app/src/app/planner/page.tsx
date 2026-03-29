"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/nav";
import { Zap, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

interface SuggestedExercise {
  exerciseName: string;
  bucket: string;
  sets: number;
  reps: string;
  notes?: string;
}

interface PlannerResult {
  sessionType: string;
  explanation: string;
  suggestedExercises: SuggestedExercise[];
  daysSinceLastSession: number;
  bucketRecency: Array<{ bucket: string; lastTrainedDaysAgo: number; totalSetsLast7d: number }>;
}

export default function PlannerPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<PlannerResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState({ lowEnergy: false, sick: false, shortOnTime: false });

  function fetchPlan(ctx = context) {
    setLoading(true);
    fetch("/api/planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: ctx }),
    })
      .then(r => r.json())
      .then(p => { setPlan(p); setLoading(false); });
  }

  useEffect(() => { fetchPlan(); }, []);

  function toggleContext(key: keyof typeof context) {
    const newCtx = { ...context, [key]: !context[key] };
    setContext(newCtx);
    fetchPlan(newCtx);
  }

  if (loading || !plan) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-pulse text-[var(--muted-foreground)]">Planning your workout...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/">
          <ArrowLeft className="h-5 w-5 text-[var(--muted-foreground)]" />
        </Link>
        <Zap className="h-5 w-5 text-[var(--primary)]" />
        <h1 className="flex-1 text-xl font-bold">Today&apos;s Plan</h1>
        <Button variant="ghost" size="icon" onClick={() => fetchPlan()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Context toggles */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={context.lowEnergy ? "default" : "outline"} size="sm" onClick={() => toggleContext("lowEnergy")}>
          Low Energy
        </Button>
        <Button variant={context.sick ? "destructive" : "outline"} size="sm" onClick={() => toggleContext("sick")}>
          Sick
        </Button>
        <Button variant={context.shortOnTime ? "default" : "outline"} size="sm" onClick={() => toggleContext("shortOnTime")}>
          Short on Time
        </Button>
      </div>

      {/* Status */}
      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">{plan.sessionType}</Badge>
            {plan.daysSinceLastSession < 999 && (
              <span className="text-xs text-[var(--muted-foreground)]">
                Last session: {plan.daysSinceLastSession === 0 ? "today" : `${plan.daysSinceLastSession}d ago`}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{plan.explanation}</p>
        </CardContent>
      </Card>

      {/* Suggested exercises */}
      <h2 className="mb-2 text-sm font-semibold">Suggested Exercises</h2>
      <div className="mb-4 space-y-2">
        {plan.suggestedExercises.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-sm text-[var(--muted-foreground)]">
              Rest day recommended
            </CardContent>
          </Card>
        ) : (
          plan.suggestedExercises.map((ex, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium capitalize">{ex.exerciseName}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {ex.sets} sets × {ex.reps} reps
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {ex.bucket.replace(/_/g, " ")}
                  </Badge>
                </div>
                {ex.notes && <p className="mt-1 text-xs text-[var(--chart-5)]">{ex.notes}</p>}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Start workout button */}
      <Button size="lg" className="w-full" onClick={() => router.push("/workout")}>
        Start This Workout
      </Button>

      {/* Bucket recency */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-[var(--muted-foreground)]">Movement Balance (last 7d)</h2>
        <div className="grid grid-cols-2 gap-2">
          {plan.bucketRecency
            .filter(b => b.bucket !== "recovery")
            .sort((a, b) => b.lastTrainedDaysAgo - a.lastTrainedDaysAgo)
            .map(b => (
              <div key={b.bucket} className="flex items-center justify-between rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-xs">
                <span className="capitalize">{b.bucket.replace(/_/g, " ")}</span>
                <span className={b.lastTrainedDaysAgo > 7 ? "text-[var(--chart-5)]" : "text-[var(--muted-foreground)]"}>
                  {b.lastTrainedDaysAgo >= 999 ? "—" : `${b.lastTrainedDaysAgo}d`}
                  {b.totalSetsLast7d > 0 && ` · ${b.totalSetsLast7d}s`}
                </span>
              </div>
            ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
