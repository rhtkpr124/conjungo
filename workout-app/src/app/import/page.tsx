"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BottomNav } from "@/components/nav";
import { importPlainText, importCSV, importJSON, type ImportedSession } from "@/lib/parser/import";
import type { ParsedExercise } from "@/lib/parser";
import { ArrowLeft, Upload, FileText, Check } from "lucide-react";
import Link from "next/link";

export default function ImportPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [parsedSessions, setParsedSessions] = useState<ImportedSession[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [importType, setImportType] = useState<"text" | "csv" | "json">("text");

  function handleParse() {
    let sessions: ImportedSession[];
    switch (importType) {
      case "csv":
        sessions = importCSV(text);
        break;
      case "json":
        sessions = importJSON(text);
        break;
      default:
        sessions = importPlainText(text);
    }
    setParsedSessions(sessions);
  }

  async function handleImport() {
    setImporting(true);
    try {
      for (const session of parsedSessions) {
        const exerciseEntries = session.entries.filter(e => e.type === "exercise") as Array<ParsedExercise>;

        const exercises = await Promise.all(
          exerciseEntries.map(async (entry, i) => {
            // Resolve exercise
            const res = await fetch("/api/exercises/resolve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: entry.exerciseName }),
            });
            const resolved = await res.json();

            return {
              exerciseId: resolved?.id || null,
              displayNameUsed: entry.exerciseName,
              orderIndex: i,
              sets: entry.sets.map((s, j) => ({
                setIndex: j,
                setType: s.setType,
                weight: s.weight,
                reps: s.reps,
                totalLoad: (s.weight || 0) * s.reps,
              })),
            };
          })
        );

        await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: session.date,
            exercises: exercises.filter(e => e.exerciseId),
          }),
        });

        // Handle bodyweight entries
        for (const entry of session.entries) {
          if (entry.type === "bodyweight") {
            await fetch("/api/bodyweight", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ weight: entry.weight, date: session.date }),
            });
          }
          if (entry.type === "context") {
            await fetch("/api/context", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: entry.contextType, value: entry.value, date: session.date }),
            });
          }
        }
      }
      setImported(true);
      setTimeout(() => router.push("/history"), 1500);
    } catch (err) {
      console.error("Import failed:", err);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/">
          <ArrowLeft className="h-5 w-5 text-[var(--muted-foreground)]" />
        </Link>
        <Upload className="h-5 w-5 text-[var(--primary)]" />
        <h1 className="text-xl font-bold">Import Workouts</h1>
      </div>

      {imported ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8">
            <Check className="h-12 w-12 text-green-400" />
            <p className="text-lg font-semibold">Imported {parsedSessions.length} sessions</p>
            <p className="text-sm text-[var(--muted-foreground)]">Redirecting to history...</p>
          </CardContent>
        </Card>
      ) : parsedSessions.length > 0 ? (
        <>
          <h2 className="mb-3 text-sm font-semibold">Review ({parsedSessions.length} sessions found)</h2>
          <div className="mb-4 max-h-[60vh] space-y-2 overflow-y-auto">
            {parsedSessions.map((session, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <div className="text-sm font-medium">{session.date}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {session.entries
                      .filter(e => e.type === "exercise")
                      .map((e, j) => (
                        <Badge key={j} variant="secondary" className="text-[10px] capitalize">
                          {(e as ParsedExercise).exerciseName}
                        </Badge>
                      ))}
                    {session.entries.filter(e => e.type === "bodyweight").length > 0 && (
                      <Badge variant="outline" className="text-[10px]">bodyweight</Badge>
                    )}
                    {session.entries.filter(e => e.type === "context").length > 0 && (
                      <Badge variant="outline" className="text-[10px]">context</Badge>
                    )}
                    {session.entries.filter(e => e.type === "unknown").length > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {session.entries.filter(e => e.type === "unknown").length} unresolved
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setParsedSessions([])}>
              Back
            </Button>
            <Button className="flex-1" onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : `Import ${parsedSessions.length} Sessions`}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Tabs value={importType} onValueChange={(v) => setImportType(v as "text" | "csv" | "json")}>
            <TabsList className="mb-3 w-full">
              <TabsTrigger value="text" className="flex-1">Plain Text</TabsTrigger>
              <TabsTrigger value="csv" className="flex-1">CSV</TabsTrigger>
              <TabsTrigger value="json" className="flex-1">JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="text">
              <p className="mb-2 text-xs text-[var(--muted-foreground)]">
                Paste workout logs with dates. Each date starts a new session.
              </p>
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={"3/15/2024\nbench 155 x 5 x 3\nincline db press 50 x 10, 10, 8\n\n3/17/2024\nsquat 225 x 5 x 3\nrdl 155 x 8 x 3"}
                rows={12}
                className="mb-3 font-mono text-sm"
              />
            </TabsContent>

            <TabsContent value="csv">
              <p className="mb-2 text-xs text-[var(--muted-foreground)]">
                CSV with columns: date, exercise, weight, reps, sets
              </p>
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={"date,exercise,weight,reps,sets\n2024-03-15,bench press,155,5,3\n2024-03-15,incline db press,50,10,3"}
                rows={12}
                className="mb-3 font-mono text-sm"
              />
            </TabsContent>

            <TabsContent value="json">
              <p className="mb-2 text-xs text-[var(--muted-foreground)]">
                JSON array of workout objects with date, exercises, bodyweight, notes.
              </p>
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={'[\n  {\n    "date": "2024-03-15",\n    "exercises": [\n      { "name": "bench press", "sets": [{ "weight": 155, "reps": 5 }] }\n    ]\n  }\n]'}
                rows={12}
                className="mb-3 font-mono text-sm"
              />
            </TabsContent>
          </Tabs>

          <div className="flex gap-3">
            <label className="flex-1">
              <input
                type="file"
                accept=".txt,.csv,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    setText(reader.result as string);
                    if (file.name.endsWith(".csv")) setImportType("csv");
                    else if (file.name.endsWith(".json")) setImportType("json");
                    else setImportType("text");
                  };
                  reader.readAsText(file);
                }}
              />
              <Button variant="outline" className="w-full" asChild>
                <span><FileText className="mr-2 h-4 w-4" /> Upload File</span>
              </Button>
            </label>
            <Button className="flex-1" onClick={handleParse} disabled={!text.trim()}>
              Parse
            </Button>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
