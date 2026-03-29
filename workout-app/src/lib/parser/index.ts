export type ParsedEntryType = "exercise" | "bodyweight" | "context" | "correction" | "done" | "unknown";

export interface ParsedSet {
  weight: number | null;
  reps: number;
  isBodyweight: boolean;
  bodyweightPlus: number | null;
  setType: "warmup" | "working" | "dropset";
}

export interface ParsedExercise {
  type: "exercise";
  rawText: string;
  exerciseName: string;
  sets: ParsedSet[];
  notes: string | null;
}

export interface ParsedBodyweight {
  type: "bodyweight";
  rawText: string;
  weight: number;
}

export interface ParsedContext {
  type: "context";
  rawText: string;
  contextType: string;
  value: string | null;
}

export interface ParsedCorrection {
  type: "correction";
  rawText: string;
  newValue: string;
}

export interface ParsedDone {
  type: "done";
  rawText: string;
}

export interface ParsedUnknown {
  type: "unknown";
  rawText: string;
}

export type ParsedEntry = ParsedExercise | ParsedBodyweight | ParsedContext | ParsedCorrection | ParsedDone | ParsedUnknown;

// Context patterns
const CONTEXT_PATTERNS: Array<{ pattern: RegExp; contextType: string; valueExtractor?: (match: RegExpMatchArray) => string }> = [
  { pattern: /^i'?m\s+sick/i, contextType: "illness" },
  { pattern: /^sick/i, contextType: "illness" },
  { pattern: /^feeling\s+(sick|ill|unwell)/i, contextType: "illness" },
  { pattern: /^slept\s+(\d+\.?\d*)\s*(?:hours?|hrs?)/i, contextType: "sleep", valueExtractor: (m) => m[1] },
  { pattern: /^(\d+\.?\d*)\s*(?:hours?|hrs?)\s*(?:of\s+)?sleep/i, contextType: "sleep", valueExtractor: (m) => m[1] },
  { pattern: /^low\s+(?:energy|sleep)/i, contextType: "low_energy" },
  { pattern: /^tired/i, contextType: "low_energy" },
  { pattern: /^fatigued/i, contextType: "low_energy" },
  { pattern: /^stressed/i, contextType: "stress" },
  { pattern: /^travel(?:ing|led)?/i, contextType: "travel" },
  { pattern: /^recovery\s*(?:day)?/i, contextType: "recovery_day" },
  { pattern: /^rest\s*day/i, contextType: "recovery_day" },
  { pattern: /^deload/i, contextType: "deload" },
  { pattern: /^skip(?:ped|ping)?/i, contextType: "skipped" },
  { pattern: /^sore/i, contextType: "soreness" },
  { pattern: /^yoga/i, contextType: "yoga" },
  { pattern: /^ran?\s+(\d+\.?\d*)\s*(mi(?:les?)?|km|k)\b/i, contextType: "run", valueExtractor: (m) => `${m[1]} ${m[2]}` },
  { pattern: /^walk(?:ed)?\s+(\d+\.?\d*)\s*(mi(?:les?)?|km|k)\b/i, contextType: "walk", valueExtractor: (m) => `${m[1]} ${m[2]}` },
  { pattern: /^short\s+on\s+time/i, contextType: "short_time" },
  { pattern: /^(\d+)\s*min(?:utes?)?\s*(?:only|max|available)/i, contextType: "time_limit", valueExtractor: (m) => m[1] },
];

// Bodyweight pattern
const BODYWEIGHT_PATTERN = /^(?:bodyweight|bw|body\s+weight|weight)\s+(\d+\.?\d*)\s*(?:lbs?|kgs?|pounds?|kilos?)?$/i;

// Done pattern
const DONE_PATTERN = /^(?:done|finished?|end|that'?s\s+it|wrap\s+up)$/i;

// Correction pattern
const CORRECTION_PATTERN = /^(?:actually|correction|change|make\s+(?:that|it)|fix)\s+(.+)/i;

// Exercise pattern components
// Matches: "bench 155 x 5 x 3", "bench press 155x5x3", "incline db press 60 x 10, 10, 8"
// Also: "squat 225 x 5, 275 x 3, 315 x 3" (progressive sets)
// Also: "pullups bw x 8, 7, 6"
// Also: "weighted pullups +20 x 5 x 2"

function parseExerciseLine(line: string): ParsedExercise | null {
  const trimmed = line.trim();

  // Try to split into exercise name and set data
  // Look for where numbers start (the set/weight data)
  // But exercise names can't start with numbers

  // Pattern: exercise_name weight_data
  // weight_data starts with a number, "bw", or "+"
  const nameDataSplit = trimmed.match(/^(.+?)\s+((?:\d|bw|\+).+)$/i);

  if (!nameDataSplit) return null;

  const exerciseName = nameDataSplit[1].trim().toLowerCase();
  const setData = nameDataSplit[2].trim();

  // Don't parse if the "exercise name" looks like context
  if (exerciseName.match(/^(slept|sleep|sick|tired|stressed|travel|recovery|rest|sore|yoga|ran|walk|bodyweight|bw|weight|done|finished|actually|correction)$/i)) {
    return null;
  }

  const sets = parseSetData(setData);

  if (sets.length === 0) return null;

  return {
    type: "exercise",
    rawText: trimmed,
    exerciseName,
    sets,
    notes: null,
  };
}

function parseSetData(data: string): ParsedSet[] {
  const sets: ParsedSet[] = [];

  // Check for bodyweight prefix
  const isBW = /^bw\b/i.test(data);
  const bwPlusMatch = data.match(/^\+(\d+\.?\d*)/);

  // Check for progressive sets: "225 x 5, 275 x 3, 315 x 3"
  if (data.includes(",") && /\d+\s*[x×]\s*\d+\s*,\s*\d+\s*[x×]\s*\d+/.test(data)) {
    // Progressive sets like "225 x 5, 275 x 3, 315 x 3"
    const parts = data.split(",").map(s => s.trim());
    for (const part of parts) {
      const m = part.match(/(\d+\.?\d*)\s*[x×]\s*(\d+)/i);
      if (m) {
        sets.push({
          weight: parseFloat(m[1]),
          reps: parseInt(m[2]),
          isBodyweight: false,
          bodyweightPlus: null,
          setType: "working",
        });
      }
    }
    return sets;
  }

  if (isBW) {
    // "bw x 8, 7, 6" or "bw x 8 x 3"
    const afterBW = data.replace(/^bw\s*/i, "").trim();
    return parseBWSetData(afterBW, 0);
  }

  if (bwPlusMatch) {
    // "+20 x 5 x 2"
    const extraWeight = parseFloat(bwPlusMatch[1]);
    const afterPlus = data.replace(/^\+\d+\.?\d*\s*/, "").trim();
    return parseBWSetData(afterPlus, extraWeight);
  }

  // Standard: "155 x 5 x 3" or "60 x 10, 10, 8" or "330 x 15"
  const mainMatch = data.match(/^(\d+\.?\d*)\s*[x×]\s*(.+)$/i);
  if (!mainMatch) {
    // Maybe just "155 x 5"
    const simpleMatch = data.match(/^(\d+\.?\d*)\s*[x×]\s*(\d+)$/i);
    if (simpleMatch) {
      sets.push({
        weight: parseFloat(simpleMatch[1]),
        reps: parseInt(simpleMatch[2]),
        isBodyweight: false,
        bodyweightPlus: null,
        setType: "working",
      });
      return sets;
    }
    return [];
  }

  const weight = parseFloat(mainMatch[1]);
  const restPart = mainMatch[2].trim();

  // Check for "5 x 3" pattern (reps x sets)
  const repsXSets = restPart.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (repsXSets) {
    const reps = parseInt(repsXSets[1]);
    const numSets = parseInt(repsXSets[2]);
    for (let i = 0; i < numSets; i++) {
      sets.push({
        weight,
        reps,
        isBodyweight: false,
        bodyweightPlus: null,
        setType: "working",
      });
    }
    return sets;
  }

  // Comma-separated reps: "10, 10, 8"
  const repsList = restPart.split(",").map(s => s.trim());
  if (repsList.every(s => /^\d+$/.test(s))) {
    for (const r of repsList) {
      sets.push({
        weight,
        reps: parseInt(r),
        isBodyweight: false,
        bodyweightPlus: null,
        setType: "working",
      });
    }
    return sets;
  }

  // Single number
  if (/^\d+$/.test(restPart)) {
    sets.push({
      weight,
      reps: parseInt(restPart),
      isBodyweight: false,
      bodyweightPlus: null,
      setType: "working",
    });
    return sets;
  }

  return sets;
}

function parseBWSetData(data: string, extraWeight: number): ParsedSet[] {
  const sets: ParsedSet[] = [];

  // Remove leading "x" or "×"
  const cleaned = data.replace(/^[x×]\s*/i, "").trim();

  // "8 x 3" pattern
  const repsXSets = cleaned.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (repsXSets) {
    const reps = parseInt(repsXSets[1]);
    const numSets = parseInt(repsXSets[2]);
    for (let i = 0; i < numSets; i++) {
      sets.push({
        weight: extraWeight || null,
        reps,
        isBodyweight: true,
        bodyweightPlus: extraWeight || null,
        setType: "working",
      });
    }
    return sets;
  }

  // Comma-separated: "8, 7, 6"
  const repsList = cleaned.split(",").map(s => s.trim());
  if (repsList.every(s => /^\d+$/.test(s))) {
    for (const r of repsList) {
      sets.push({
        weight: extraWeight || null,
        reps: parseInt(r),
        isBodyweight: true,
        bodyweightPlus: extraWeight || null,
        setType: "working",
      });
    }
    return sets;
  }

  // Single number
  if (/^\d+$/.test(cleaned)) {
    sets.push({
      weight: extraWeight || null,
      reps: parseInt(cleaned),
      isBodyweight: true,
      bodyweightPlus: extraWeight || null,
      setType: "working",
    });
    return sets;
  }

  return sets;
}

export function parseLine(line: string): ParsedEntry {
  const trimmed = line.trim();
  if (!trimmed) return { type: "unknown", rawText: line };

  // Check done
  if (DONE_PATTERN.test(trimmed)) {
    return { type: "done", rawText: trimmed };
  }

  // Check bodyweight
  const bwMatch = trimmed.match(BODYWEIGHT_PATTERN);
  if (bwMatch) {
    return { type: "bodyweight", rawText: trimmed, weight: parseFloat(bwMatch[1]) };
  }

  // Check context patterns
  for (const { pattern, contextType, valueExtractor } of CONTEXT_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        type: "context",
        rawText: trimmed,
        contextType,
        value: valueExtractor ? valueExtractor(match) : null,
      };
    }
  }

  // Check correction
  const corrMatch = trimmed.match(CORRECTION_PATTERN);
  if (corrMatch) {
    return { type: "correction", rawText: trimmed, newValue: corrMatch[1].trim() };
  }

  // Try exercise parse
  const exercise = parseExerciseLine(trimmed);
  if (exercise) return exercise;

  return { type: "unknown", rawText: trimmed };
}

export function parseWorkoutText(text: string): ParsedEntry[] {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(parseLine);
}
