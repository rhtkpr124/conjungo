"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BottomNav } from "@/components/nav";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";

interface ExerciseProgress {
  exerciseId: string;
  name: string;
  bucketName: string;
  dataPoints: Array<{
    date: string;
    bestWeight: number;
    bestReps: number;
    totalVolume: number;
    estimatedE1RM: number;
    totalSets: number;
  }>;
}

interface BucketProgress {
  bucketId: string;
  bucketName: string;
  dataPoints: Array<{
    date: string;
    normalizedScore: number;
    totalVolume: number;
    totalSets: number;
  }>;
  exercises: string[];
}

interface ProgressData {
  exerciseProgress: ExerciseProgress[];
  bucketProgress: BucketProgress[];
  summary: { sessionCount: number; totalSets: number; totalVolume: number; days: number };
}

interface BWEntry {
  date: string;
  weight: number;
}

const TIME_RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
  { label: "All", days: 9999 },
];

const CHART_COLORS = {
  primary: "oklch(0.75 0.15 160)",
  secondary: "oklch(0.65 0.15 250)",
  tertiary: "oklch(0.70 0.12 80)",
  quaternary: "oklch(0.65 0.18 330)",
};

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [bodyweight, setBodyweight] = useState<BWEntry[]>([]);
  const [days, setDays] = useState(90);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/progress?days=${days}`).then(r => r.json()),
      fetch(`/api/bodyweight?days=${days}`).then(r => r.json()),
    ]).then(([p, b]) => {
      setData(p);
      setBodyweight(b);
      setLoading(false);
    });
  }, [days]);

  if (loading || !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-pulse text-[var(--muted-foreground)]">Loading...</div>
      </div>
    );
  }

  const selectedData = selectedExercise
    ? data.exerciseProgress.find(e => e.exerciseId === selectedExercise)
    : null;

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <h1 className="mb-2 text-2xl font-bold">Progress</h1>

      {/* Time range filter */}
      <div className="mb-4 flex gap-2">
        {TIME_RANGES.map(tr => (
          <Button
            key={tr.label}
            variant={days === tr.days ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(tr.days)}
          >
            {tr.label}
          </Button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{data.summary.sessionCount}</div>
            <div className="text-xs text-[var(--muted-foreground)]">Sessions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{data.summary.totalSets}</div>
            <div className="text-xs text-[var(--muted-foreground)]">Total Sets</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{(data.summary.totalVolume / 1000).toFixed(0)}k</div>
            <div className="text-xs text-[var(--muted-foreground)]">Volume (lb)</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="exercises" className="mb-4">
        <TabsList className="w-full">
          <TabsTrigger value="exercises" className="flex-1">Exercises</TabsTrigger>
          <TabsTrigger value="buckets" className="flex-1">Buckets</TabsTrigger>
          <TabsTrigger value="bodyweight" className="flex-1">Bodyweight</TabsTrigger>
        </TabsList>

        {/* Exercise Progress */}
        <TabsContent value="exercises">
          {!selectedExercise ? (
            <div className="space-y-2">
              {data.exerciseProgress.length === 0 ? (
                <Card><CardContent className="p-4 text-center text-sm text-[var(--muted-foreground)]">No exercise data yet</CardContent></Card>
              ) : (
                data.exerciseProgress.map(ep => {
                  const first = ep.dataPoints[0];
                  const last = ep.dataPoints[ep.dataPoints.length - 1];
                  const trend = last && first ? last.estimatedE1RM - first.estimatedE1RM : 0;
                  return (
                    <Card
                      key={ep.exerciseId}
                      className="cursor-pointer transition-colors hover:bg-[var(--accent)]"
                      onClick={() => setSelectedExercise(ep.exerciseId)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium capitalize">{ep.name}</div>
                            <div className="text-xs text-[var(--muted-foreground)]">{ep.bucketName.replace(/_/g, " ")} · {ep.dataPoints.length} sessions</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{last?.estimatedE1RM || 0} lb</div>
                            <div className={`text-xs ${trend > 0 ? "text-green-400" : trend < 0 ? "text-red-400" : "text-[var(--muted-foreground)]"}`}>
                              {trend > 0 ? "+" : ""}{trend} e1RM
                            </div>
                          </div>
                        </div>
                        {/* Mini sparkline */}
                        {ep.dataPoints.length > 1 && (
                          <div className="mt-2 h-10">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={ep.dataPoints}>
                                <Line
                                  type="monotone"
                                  dataKey="estimatedE1RM"
                                  stroke={CHART_COLORS.primary}
                                  strokeWidth={1.5}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
            <div>
              <Button variant="ghost" size="sm" className="mb-3" onClick={() => setSelectedExercise(null)}>
                ← All exercises
              </Button>
              {selectedData && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="capitalize">{selectedData.name}</CardTitle>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {selectedData.bucketName.replace(/_/g, " ")} · {selectedData.dataPoints.length} sessions
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* E1RM chart */}
                    <div className="mb-4">
                      <div className="mb-1 text-xs text-[var(--muted-foreground)]">Estimated 1RM</div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={selectedData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                            <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                            <Tooltip
                              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                              labelStyle={{ color: "var(--foreground)" }}
                            />
                            <Area type="monotone" dataKey="estimatedE1RM" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.1} name="Est. 1RM (lb)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    {/* Volume chart */}
                    <div>
                      <div className="mb-1 text-xs text-[var(--muted-foreground)]">Volume per session</div>
                      <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={selectedData.dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                            <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                            <Bar dataKey="totalVolume" fill={CHART_COLORS.secondary} name="Volume (lb)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    {/* Stats */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-lg bg-[var(--secondary)] p-2">
                        <div className="text-lg font-bold">{selectedData.dataPoints[selectedData.dataPoints.length - 1]?.bestWeight || 0}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">Best weight</div>
                      </div>
                      <div className="rounded-lg bg-[var(--secondary)] p-2">
                        <div className="text-lg font-bold">{selectedData.dataPoints[selectedData.dataPoints.length - 1]?.estimatedE1RM || 0}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">Est. 1RM</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Bucket Progress */}
        <TabsContent value="buckets">
          <div className="space-y-3">
            {data.bucketProgress.length === 0 ? (
              <Card><CardContent className="p-4 text-center text-sm text-[var(--muted-foreground)]">No bucket data yet</CardContent></Card>
            ) : (
              data.bucketProgress.map(bp => {
                // Aggregate: for each date, take the max normalized score
                const dateMap = new Map<string, { score: number; volume: number; sets: number }>();
                for (const dp of bp.dataPoints) {
                  const existing = dateMap.get(dp.date);
                  if (!existing || dp.normalizedScore > existing.score) {
                    dateMap.set(dp.date, { score: dp.normalizedScore, volume: dp.totalVolume, sets: dp.totalSets });
                  }
                }
                const chartData = Array.from(dateMap.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, vals]) => ({ date, ...vals }));

                const firstScore = chartData[0]?.score || 0;
                const lastScore = chartData[chartData.length - 1]?.score || 0;
                const trend = lastScore - firstScore;

                return (
                  <Card key={bp.bucketId}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium capitalize">{bp.bucketName.replace(/_/g, " ")}</div>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {bp.exercises.map((ex, i) => (
                              <Badge key={i} variant="outline" className="text-[10px]">{ex}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{lastScore}</div>
                          <div className={`text-xs ${trend > 0 ? "text-green-400" : trend < 0 ? "text-red-400" : "text-[var(--muted-foreground)]"}`}>
                            {trend > 0 ? "+" : ""}{trend}
                          </div>
                          <Badge variant="secondary" className="mt-0.5 text-[10px]">
                            {bp.exercises.length === 1 ? "high" : bp.exercises.length <= 3 ? "medium" : "low"} confidence
                          </Badge>
                        </div>
                      </div>
                      {chartData.length > 1 && (
                        <div className="mt-2 h-16">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <Line type="monotone" dataKey="score" stroke={CHART_COLORS.tertiary} strokeWidth={1.5} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Bodyweight */}
        <TabsContent value="bodyweight">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Bodyweight</CardTitle>
            </CardHeader>
            <CardContent>
              {bodyweight.length === 0 ? (
                <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">No bodyweight entries</p>
              ) : (
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={bodyweight.map(b => ({ date: new Date(b.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), weight: b.weight }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                        <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                        <Area type="monotone" dataKey="weight" stroke={CHART_COLORS.quaternary} fill={CHART_COLORS.quaternary} fillOpacity={0.1} name="Weight (lb)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-[var(--secondary)] p-2">
                      <div className="text-lg font-bold">{bodyweight[bodyweight.length - 1].weight}</div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">Current</div>
                    </div>
                    <div className="rounded-lg bg-[var(--secondary)] p-2">
                      <div className="text-lg font-bold">{Math.min(...bodyweight.map(b => b.weight)).toFixed(1)}</div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">Low</div>
                    </div>
                    <div className="rounded-lg bg-[var(--secondary)] p-2">
                      <div className="text-lg font-bold">{Math.max(...bodyweight.map(b => b.weight)).toFixed(1)}</div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">High</div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BottomNav />
    </div>
  );
}
