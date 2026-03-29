import { parseWorkoutText, ParsedEntry } from "./index";

export interface ImportedSession {
  date: string;
  entries: ParsedEntry[];
  rawText: string;
}

export function importPlainText(text: string): ImportedSession[] {
  const sessions: ImportedSession[] = [];
  const lines = text.split("\n");

  let currentDate: string | null = null;
  let currentLines: string[] = [];

  // Date patterns
  const datePatterns = [
    /^(?:##?\s*)?(\d{1,2}\/\d{1,2}\/\d{2,4})/,       // 3/15/2024
    /^(?:##?\s*)?(\d{4}-\d{2}-\d{2})/,                  // 2024-03-15
    /^(?:##?\s*)?((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s*,?\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}\s*,?\s*\d{4})/i, // Monday, March 15, 2024
    /^(?:##?\s*)?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}\s*,?\s*\d{4})/i, // March 15, 2024
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let foundDate: string | null = null;
    for (const pattern of datePatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const parsed = new Date(match[1]);
        if (!isNaN(parsed.getTime())) {
          foundDate = parsed.toISOString().split("T")[0];
          break;
        }
      }
    }

    if (foundDate) {
      // Save previous session
      if (currentDate && currentLines.length > 0) {
        sessions.push({
          date: currentDate,
          entries: parseWorkoutText(currentLines.join("\n")),
          rawText: currentLines.join("\n"),
        });
      }
      currentDate = foundDate;
      currentLines = [];
    } else if (currentDate) {
      currentLines.push(trimmed);
    } else {
      // No date yet, use today
      currentDate = new Date().toISOString().split("T")[0];
      currentLines.push(trimmed);
    }
  }

  // Save last session
  if (currentDate && currentLines.length > 0) {
    sessions.push({
      date: currentDate,
      entries: parseWorkoutText(currentLines.join("\n")),
      rawText: currentLines.join("\n"),
    });
  }

  return sessions;
}

export interface CSVRow {
  date?: string;
  exercise?: string;
  weight?: string;
  reps?: string;
  sets?: string;
  notes?: string;
  [key: string]: string | undefined;
}

export function importCSV(csvText: string): ImportedSession[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
  const sessions = new Map<string, ParsedEntry[]>();

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim().replace(/['"]/g, ""));
    const row: CSVRow = {};
    headers.forEach((h, idx) => { row[h] = values[idx]; });

    const date = row.date || new Date().toISOString().split("T")[0];
    const exercise = row.exercise || row.name || "";
    const weight = row.weight || "0";
    const reps = row.reps || "0";
    const sets = row.sets || "1";

    if (!exercise) continue;

    if (!sessions.has(date)) sessions.set(date, []);

    // Reconstruct as text and parse
    const numSets = parseInt(sets) || 1;
    const line = `${exercise} ${weight} x ${reps} x ${numSets}`;
    const parsed = parseWorkoutText(line);
    sessions.get(date)!.push(...parsed);
  }

  return Array.from(sessions.entries()).map(([date, entries]) => ({
    date,
    entries,
    rawText: entries.map(e => e.rawText).join("\n"),
  }));
}

export interface JSONWorkout {
  date: string;
  exercises?: Array<{
    name: string;
    sets: Array<{ weight?: number; reps?: number; bodyweight?: boolean }>;
  }>;
  bodyweight?: number;
  notes?: string;
}

export function importJSON(jsonText: string): ImportedSession[] {
  try {
    const data = JSON.parse(jsonText);
    const workouts: JSONWorkout[] = Array.isArray(data) ? data : [data];

    return workouts.map(w => {
      const lines: string[] = [];

      if (w.bodyweight) lines.push(`bodyweight ${w.bodyweight}`);
      if (w.notes) lines.push(w.notes);

      for (const ex of (w.exercises || [])) {
        if (ex.sets.length === 0) continue;
        const firstWeight = ex.sets[0].weight || 0;
        const allSameWeight = ex.sets.every(s => (s.weight || 0) === firstWeight);

        if (allSameWeight) {
          const reps = ex.sets.map(s => s.reps || 0).join(", ");
          lines.push(`${ex.name} ${firstWeight} x ${reps}`);
        } else {
          const parts = ex.sets.map(s => `${s.weight || 0} x ${s.reps || 0}`);
          lines.push(`${ex.name} ${parts.join(", ")}`);
        }
      }

      return {
        date: w.date,
        entries: parseWorkoutText(lines.join("\n")),
        rawText: lines.join("\n"),
      };
    });
  } catch {
    return [];
  }
}
