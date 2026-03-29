"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Trash2, Copy } from "lucide-react";
import Link from "next/link";

interface SetEntry {
  id: string;
  setIndex: number;
  setType: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  totalLoad: number | null;
  notes: string | null;
}

interface SessionExercise {
  id: string;
  displayNameUsed: string;
  orderIndex: number;
  notes: string | null;
  sets: SetEntry[];
  exercise: { canonicalName: string; primaryBucket: { name: string } };
}

interface Session {
  id: string;
  date: string;
  sessionType: string;
  notes: string | null;
  sleepHours: number | null;
  energyRating: number | null;
  illnessFlag: boolean;
  tags: string;
  startedAt: string;
  endedAt: string | null;
  exercises: SessionExercise[];
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sessions/${params.id}`)
      .then(r => r.json())
      .then(s => { setSession(s); setLoading(false); });
  }, [params.id]);

  async function handleDelete() {
    if (!confirm("Delete this session?")) return;
    await fetch(`/api/sessions/${params.id}`, { method: "DELETE" });
    router.push("/history");
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-pulse text-[var(--muted-foreground)]">Loading...</div>
      </div>
    );
  }

  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const totalVolume = session.exercises.reduce((a, e) =>
    a + e.sets.reduce((v, s) => v + ((s.weight || 0) * (s.reps || 0)), 0), 0);
  const tags = JSON.parse(session.tags || "[]") as string[];

  const duration = session.endedAt
    ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
    : null;

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Link href="/history">
          <ArrowLeft className="h-5 w-5 text-[var(--muted-foreground)]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{formatDate(session.date)}</h1>
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span>{totalSets} sets</span>
            <span>·</span>
            <span>{(totalVolume / 1000).toFixed(1)}k lb volume</span>
            {duration && <><span>·</span><span>{duration} min</span></>}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 text-[var(--destructive)]" />
        </Button>
      </div>

      {/* Tags and context */}
      {(tags.length > 0 || session.notes || session.sleepHours) && (
        <div className="mb-4 flex flex-wrap gap-1">
          {tags.map((t, i) => (
            <Badge key={i} variant="outline" className="text-xs capitalize">{t.replace(/_/g, " ")}</Badge>
          ))}
          {session.illnessFlag && <Badge variant="destructive" className="text-xs">sick</Badge>}
          {session.sleepHours && <Badge variant="secondary" className="text-xs">{session.sleepHours}h sleep</Badge>}
          {session.notes && <p className="mt-1 w-full text-xs text-[var(--muted-foreground)]">{session.notes}</p>}
        </div>
      )}

      {/* Exercises */}
      <div className="space-y-3">
        {session.exercises.map(ex => (
          <Card key={ex.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm capitalize">{ex.displayNameUsed}</CardTitle>
                <Badge variant="secondary" className="text-[10px]">
                  {ex.exercise.primaryBucket.name.replace(/_/g, " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {ex.sets.map((set, i) => (
                  <div key={set.id} className="flex items-center gap-3 text-sm">
                    <span className="w-6 text-xs text-[var(--muted-foreground)]">{i + 1}</span>
                    <span className="flex-1">
                      {set.weight ? `${set.weight} lb` : "BW"} × {set.reps}
                    </span>
                    {set.setType !== "working" && (
                      <Badge variant="outline" className="text-[10px]">{set.setType}</Badge>
                    )}
                    {set.totalLoad ? (
                      <span className="text-xs text-[var(--muted-foreground)]">{set.totalLoad} lb vol</span>
                    ) : null}
                  </div>
                ))}
              </div>
              {ex.notes && <p className="mt-2 text-xs text-[var(--muted-foreground)]">{ex.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
