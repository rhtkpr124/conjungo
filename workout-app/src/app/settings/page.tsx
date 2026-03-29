"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/nav";

interface Exercise {
  id: string;
  canonicalName: string;
  normalizationFactor: number;
  equipmentType: string;
  isBodyweightRelevant: boolean;
  aliases: Array<{ alias: string }>;
  primaryBucket: { name: string };
}

export default function SettingsPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/exercises")
      .then(r => r.json())
      .then(e => { setExercises(e); setLoading(false); });
  }, []);

  // Group by bucket
  const grouped = new Map<string, Exercise[]>();
  for (const ex of exercises) {
    const bucket = ex.primaryBucket.name;
    if (!grouped.has(bucket)) grouped.set(bucket, []);
    grouped.get(bucket)!.push(ex);
  }

  async function handleExport() {
    const sessions = await fetch("/api/sessions?limit=9999").then(r => r.json());
    const bodyweight = await fetch("/api/bodyweight?days=9999").then(r => r.json());
    const context = await fetch("/api/context?days=9999").then(r => r.json());

    const data = { sessions, bodyweight, context, exercises, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workout-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-pulse text-[var(--muted-foreground)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <h1 className="mb-4 text-2xl font-bold">Settings</h1>

      {/* Export */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={handleExport}>
            Export All Data (JSON)
          </Button>
        </CardContent>
      </Card>

      {/* Exercise taxonomy */}
      <h2 className="mb-2 text-lg font-semibold">Exercise Taxonomy</h2>
      <p className="mb-3 text-xs text-[var(--muted-foreground)]">
        {exercises.length} exercises across {grouped.size} movement buckets. Normalization factors affect bucket-level progress comparisons.
      </p>

      {Array.from(grouped.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([bucket, bucketExercises]) => (
          <div key={bucket} className="mb-4">
            <h3 className="mb-2 text-sm font-semibold capitalize text-[var(--muted-foreground)]">
              {bucket.replace(/_/g, " ")}
            </h3>
            <div className="space-y-2">
              {bucketExercises.map(ex => (
                <Card key={ex.id}>
                  <CardContent className="p-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium capitalize">{ex.canonicalName}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {ex.aliases.map((a, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{a.alias}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right text-xs text-[var(--muted-foreground)]">
                        <div>{ex.equipmentType}</div>
                        <div>norm: {ex.normalizationFactor}</div>
                        {ex.isBodyweightRelevant && <Badge variant="secondary" className="text-[10px]">BW</Badge>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

      <BottomNav />
    </div>
  );
}
