"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseLine, type ParsedEntry, type ParsedExercise } from "@/lib/parser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/nav";
import { PretextMessage } from "@/components/pretext-message";
import { Send, Check, Edit2, X, Dumbbell, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface LogEntry {
  id: number;
  input: string;
  parsed: ParsedEntry;
  resolvedExerciseId?: string;
  editing: boolean;
}

interface ResolvedExercise {
  id: string;
  canonicalName: string;
  primaryBucket: { name: string };
}

export default function WorkoutLogger() {
  const router = useRouter();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [sessionNotes, setSessionNotes] = useState<string[]>([]);
  const [contextTags, setContextTags] = useState<Array<{ type: string; value: string | null }>>([]);
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [entries, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function resolveExercise(name: string): Promise<ResolvedExercise | null> {
    try {
      const res = await fetch("/api/exercises/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      return await res.json();
    } catch {
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    if (!sessionStarted) setSessionStarted(true);

    const parsed = parseLine(trimmed);
    const id = nextId.current++;
    const entry: LogEntry = { id, input: trimmed, parsed, editing: false };

    if (parsed.type === "exercise") {
      const resolved = await resolveExercise(parsed.exerciseName);
      if (resolved) {
        entry.resolvedExerciseId = resolved.id;
      }
    }

    if (parsed.type === "bodyweight") {
      setBodyweight(parsed.weight);
    }

    if (parsed.type === "context") {
      setContextTags(prev => [...prev, { type: parsed.contextType, value: parsed.value }]);
      if (parsed.contextType === "sleep" && parsed.value) {
        setSessionNotes(prev => [...prev, `Sleep: ${parsed.value} hours`]);
      }
    }

    if (parsed.type === "done") {
      await saveSession([...entries, entry]);
      return;
    }

    if (parsed.type === "correction") {
      // Apply correction to last exercise entry
      const lastExIdx = [...entries].reverse().findIndex(e => e.parsed.type === "exercise");
      if (lastExIdx >= 0) {
        const correctedEntries = [...entries];
        const idx = entries.length - 1 - lastExIdx;
        const newParsed = parseLine(`${(correctedEntries[idx].parsed as ParsedExercise).exerciseName} ${parsed.newValue}`);
        if (newParsed.type === "exercise") {
          correctedEntries[idx] = { ...correctedEntries[idx], parsed: newParsed, input: `${correctedEntries[idx].input} → ${trimmed}` };
          setEntries(correctedEntries);
          setInput("");
          return;
        }
      }
    }

    setEntries(prev => [...prev, entry]);
    setInput("");
  }

  async function saveSession(allEntries: LogEntry[]) {
    setSaving(true);
    try {
      const exerciseEntries = allEntries.filter(e => e.parsed.type === "exercise") as Array<LogEntry & { parsed: ParsedExercise }>;

      const exercises = await Promise.all(
        exerciseEntries.map(async (entry, i) => {
          let exerciseId = entry.resolvedExerciseId;
          if (!exerciseId) {
            // Try to create or find exercise
            const resolved = await resolveExercise(entry.parsed.exerciseName);
            exerciseId = resolved?.id;
          }
          if (!exerciseId) {
            // Create exercise on the fly
            const res = await fetch("/api/exercises", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                canonicalName: entry.parsed.exerciseName,
                primaryBucketId: "unknown",
              }),
            });
            const created = await res.json();
            exerciseId = created.id;
          }

          return {
            exerciseId,
            displayNameUsed: entry.parsed.exerciseName,
            orderIndex: i,
            sets: entry.parsed.sets.map((s, j) => ({
              setIndex: j,
              setType: s.setType,
              weight: s.weight,
              reps: s.reps,
              bodyweightAtTime: s.isBodyweight ? bodyweight : null,
              totalLoad: s.isBodyweight
                ? ((bodyweight || 0) + (s.bodyweightPlus || 0)) * s.reps
                : (s.weight || 0) * s.reps,
            })),
          };
        })
      );

      // Save bodyweight if logged
      if (bodyweight) {
        await fetch("/api/bodyweight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weight: bodyweight }),
        });
      }

      // Save context events
      for (const ctx of contextTags) {
        await fetch("/api/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: ctx.type, value: ctx.value }),
        });
      }

      // Determine session flags
      const isSick = contextTags.some(c => c.type === "illness");
      const sleepEntry = contextTags.find(c => c.type === "sleep");

      // Save session
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date().toISOString(),
          sessionType: isSick ? "recovery" : "strength",
          notes: sessionNotes.join("; ") || null,
          illnessFlag: isSick,
          sleepHours: sleepEntry?.value ? parseFloat(sleepEntry.value) : null,
          tags: contextTags.map(c => c.type),
          exercises: exercises.filter(e => e.exerciseId),
        }),
      });

      router.push("/");
    } catch (err) {
      console.error("Failed to save session:", err);
    } finally {
      setSaving(false);
    }
  }

  function removeEntry(id: number) {
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  const exerciseCount = entries.filter(e => e.parsed.type === "exercise").length;
  const totalSets = entries
    .filter(e => e.parsed.type === "exercise")
    .reduce((acc, e) => acc + ((e.parsed as ParsedExercise).sets?.length || 0), 0);

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <Link href="/">
          <ArrowLeft className="h-5 w-5 text-[var(--muted-foreground)]" />
        </Link>
        <Dumbbell className="h-5 w-5 text-[var(--primary)]" />
        <div className="flex-1">
          <h1 className="text-base font-semibold">Workout Log</h1>
          {sessionStarted && (
            <p className="text-xs text-[var(--muted-foreground)]">
              {exerciseCount} exercises · {totalSets} sets
              {bodyweight && ` · ${bodyweight} lb`}
            </p>
          )}
        </div>
        {entries.length > 0 && (
          <Button
            size="sm"
            variant="default"
            onClick={() => saveSession(entries)}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {!sessionStarted && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-[var(--muted-foreground)]">
            <Dumbbell className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">Start typing to log your workout</p>
            <p className="mt-1 text-xs opacity-60">e.g. &quot;bench 155 x 5 x 3&quot;</p>
          </div>
        )}

        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* User input */}
              <div className="mb-1 flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--primary)] px-3 py-2 text-sm text-[var(--primary-foreground)]">
                  <PretextMessage text={entry.input} font="14px system-ui, -apple-system, sans-serif" lineHeight={20} />
                </div>
              </div>

              {/* Parsed result card */}
              <div className="flex justify-start">
                <div className="max-w-[85%]">
                  <EntryCard entry={entry} onRemove={() => removeEntry(entry.id)} />
                </div>
              </div>
            </div>
          ))}

          {/* Context tags */}
          {contextTags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {contextTags.map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs capitalize">
                  {tag.type.replace(/_/g, " ")}
                  {tag.value && `: ${tag.value}`}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--border)] bg-[var(--background)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="bench 155 x 5 x 3"
            className="flex-1"
            autoComplete="off"
            autoCapitalize="off"
          />
          <Button type="submit" size="icon" disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function EntryCard({ entry, onRemove }: { entry: LogEntry; onRemove: () => void }) {
  const { parsed } = entry;

  if (parsed.type === "exercise") {
    return (
      <Card className="border-[var(--border)]">
        <CardContent className="p-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium capitalize">{parsed.exerciseName}</div>
              <div className="mt-1 space-y-0.5">
                {parsed.sets.map((s, i) => (
                  <div key={i} className="text-xs text-[var(--muted-foreground)]">
                    {s.isBodyweight ? (
                      <>BW{s.bodyweightPlus ? ` +${s.bodyweightPlus}` : ""} × {s.reps}</>
                    ) : (
                      <>{s.weight} × {s.reps}</>
                    )}
                    {s.setType !== "working" && (
                      <span className="ml-1 text-[var(--chart-5)]">({s.setType})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-1">
              <Badge variant="secondary" className="text-[10px]">
                {parsed.sets.length} {parsed.sets.length === 1 ? "set" : "sets"}
              </Badge>
              <button onClick={onRemove} className="ml-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (parsed.type === "bodyweight") {
    return (
      <Card className="border-[var(--chart-3)]/30">
        <CardContent className="flex items-center gap-2 p-2">
          <Check className="h-4 w-4 text-[var(--chart-3)]" />
          <span className="text-sm">Bodyweight: {parsed.weight} lb</span>
        </CardContent>
      </Card>
    );
  }

  if (parsed.type === "context") {
    return (
      <Card className="border-[var(--chart-5)]/30">
        <CardContent className="flex items-center gap-2 p-2">
          <Check className="h-4 w-4 text-[var(--chart-5)]" />
          <span className="text-sm capitalize">
            {parsed.contextType.replace(/_/g, " ")}
            {parsed.value && `: ${parsed.value}`}
          </span>
        </CardContent>
      </Card>
    );
  }

  if (parsed.type === "correction") {
    return (
      <Card className="border-[var(--chart-2)]/30">
        <CardContent className="flex items-center gap-2 p-2">
          <Edit2 className="h-4 w-4 text-[var(--chart-2)]" />
          <span className="text-sm">Corrected: {parsed.newValue}</span>
        </CardContent>
      </Card>
    );
  }

  if (parsed.type === "unknown") {
    return (
      <Card className="border-[var(--muted)]/30">
        <CardContent className="flex items-center gap-2 p-2">
          <span className="text-xs text-[var(--muted-foreground)]">Saved as note: {parsed.rawText}</span>
        </CardContent>
      </Card>
    );
  }

  return null;
}
