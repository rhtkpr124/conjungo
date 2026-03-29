# Workout Tracker

A chat-first mobile workout logging app. Type natural workout entries like "bench 155 x 5 x 3" and the app parses, stores, and visualizes your training data -- no AI required.

## Stack

- **Next.js 15** with App Router
- **TypeScript**
- **Tailwind CSS v4**
- **Prisma + SQLite** (local-first, zero setup)
- **Recharts** for progress charts
- **shadcn/ui** components

## Quick Start

```bash
cd workout-app
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Chat-style workout logging** -- type entries in plain English
- **Deterministic text parser** -- no AI/LLM needed, instant parsing
- **Exercise resolution with aliases** -- "bench", "bench press", "flat bench" all resolve correctly
- **Movement bucket progress** -- track push/pull/legs/core volume over time
- **Exact exercise progress** -- per-exercise charts with estimated 1RM (e1RM)
- **Bodyweight tracking** -- log with "bw 185" or "bodyweight 185"
- **Context events** -- illness, sleep hours, travel, energy, stress, soreness
- **Workout planner** -- suggests sessions based on recent history and recovery
- **Import** -- plain text, CSV, JSON
- **Export** -- download all data
- **Dark mode, mobile-first UI**

## Screens

| Screen | Description |
|--------|-------------|
| Dashboard | Today's summary, recent activity, movement bucket overview |
| Workout Logger | Chat interface for logging sets in real time |
| Progress | Charts for exercise progress, e1RM trends, volume |
| History | Browse and filter past sessions |
| Planner | AI-free workout suggestions based on training frequency and recovery |
| Import | Bulk import from text, CSV, or JSON |
| Settings | Units, dark mode, data export |

## Architecture

```
/src/lib/parser/        Deterministic workout text parser
/src/app/api/           REST API routes
  sessions/               Workout session CRUD
  exercises/              Exercise + alias management
  bodyweight/             Bodyweight entries
  context/                Context events (sleep, illness, etc.)
  progress/               Progress queries and e1RM calculations
  planner/                Workout planning engine
/prisma/schema.prisma   Data model
/prisma/seed.ts         Sample seed data
```

**Data model:** User, Exercise, MovementBucket, WorkoutSession, SessionExercise, SetEntry, BodyweightEntry, ContextEvent.

## Parser Examples

The deterministic parser handles these formats without any AI:

```
bench 155 x 5 x 3           -> bench press, 3 sets of 5 @ 155 lbs
squat 225 x 5, 275 x 3      -> progressive sets at different weights
incline db press 60 x 10, 10, 8  -> 3 sets with descending reps @ 60
pullups bw x 8, 7, 6        -> bodyweight, 3 sets
weighted pullups +20 x 5 x 2    -> bodyweight + 20 lbs, 2 sets of 5
bw 185                       -> log bodyweight at 185
slept 7 hours                -> context: 7 hours of sleep
tired                        -> context: low energy
done                         -> end current session
```

## Optional: AI Parsing

The parser is fully deterministic by default. For ambiguous or free-form inputs, an optional LLM parsing layer can be added behind an API key. The flow:

1. User input hits the deterministic parser first
2. If the result is `unknown`, and an LLM API key is configured, send to LLM for interpretation
3. LLM returns structured data in the same `ParsedEntry` format
4. Falls back to "unknown" if both fail

This keeps the app functional offline and without any API keys.

## Future Improvements

- PWA with service worker for offline use
- AI-powered parsing for ambiguous text
- Workout templates and favorites
- Social features and sharing
- Rep PR tracking and notifications
- Superset/circuit support
- Rest timer
- Migration to Supabase/Postgres for multi-device sync
- OAuth authentication
