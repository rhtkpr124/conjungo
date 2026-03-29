import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.setEntry.deleteMany();
  await prisma.sessionExercise.deleteMany();
  await prisma.workoutSession.deleteMany();
  await prisma.bodyweightEntry.deleteMany();
  await prisma.contextEvent.deleteMany();
  await prisma.exerciseAlias.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.movementBucket.deleteMany();
  await prisma.workoutTemplate.deleteMany();
  await prisma.user.deleteMany();

  // Create user
  const user = await prisma.user.create({
    data: {
      id: "default-user",
      name: "Athlete",
      units: "lb",
      goals: JSON.stringify([
        { exercise: "bench press", target: 225, unit: "lb" },
        { exercise: "squat", target: 315, unit: "lb" },
        { exercise: "overhead press", target: 135, unit: "lb" },
        { exercise: "pull-ups", target: 20, unit: "reps" },
        { goal: "half marathon", timeline: "6 months" },
      ]),
      preferences: JSON.stringify({ theme: "dark", defaultSessionType: "strength" }),
    },
  });

  // Create movement buckets
  const bucketNames = [
    "chest_press", "vertical_press", "row", "vertical_pull",
    "squat", "hinge", "hamstring", "quad", "calf",
    "biceps", "triceps", "abs_core", "run_cardio", "recovery",
  ];
  const buckets: Record<string, { id: string }> = {};
  for (const name of bucketNames) {
    buckets[name] = await prisma.movementBucket.create({ data: { name } });
  }

  // Create exercises with aliases
  const exerciseData: Array<{
    canonicalName: string;
    bucket: string;
    equipment: string;
    bodyweight: boolean;
    normFactor: number;
    aliases: string[];
  }> = [
    { canonicalName: "bench press", bucket: "chest_press", equipment: "barbell", bodyweight: false, normFactor: 1.0, aliases: ["bench", "flat bench", "barbell bench", "bb bench"] },
    { canonicalName: "incline dumbbell press", bucket: "chest_press", equipment: "dumbbell", bodyweight: false, normFactor: 0.65, aliases: ["incline db press", "incline press", "incline dumbbell"] },
    { canonicalName: "machine chest press", bucket: "chest_press", equipment: "machine", bodyweight: false, normFactor: 0.75, aliases: ["chest press machine", "seated chest press"] },
    { canonicalName: "overhead press", bucket: "vertical_press", equipment: "barbell", bodyweight: false, normFactor: 1.0, aliases: ["ohp", "shoulder press", "military press", "press"] },
    { canonicalName: "dumbbell shoulder press", bucket: "vertical_press", equipment: "dumbbell", bodyweight: false, normFactor: 0.6, aliases: ["db shoulder press", "seated db press", "db ohp"] },
    { canonicalName: "lateral raise", bucket: "vertical_press", equipment: "dumbbell", bodyweight: false, normFactor: 0.2, aliases: ["lat raise", "side raise", "lateral raises"] },
    { canonicalName: "barbell row", bucket: "row", equipment: "barbell", bodyweight: false, normFactor: 1.0, aliases: ["bb row", "bent over row", "pendlay row", "rows"] },
    { canonicalName: "cable row", bucket: "row", equipment: "cable", bodyweight: false, normFactor: 0.8, aliases: ["seated cable row", "seated row", "cable rows"] },
    { canonicalName: "dumbbell row", bucket: "row", equipment: "dumbbell", bodyweight: false, normFactor: 0.5, aliases: ["db row", "one arm row", "single arm row"] },
    { canonicalName: "pull-ups", bucket: "vertical_pull", equipment: "bodyweight", bodyweight: true, normFactor: 1.0, aliases: ["pullups", "pull ups", "pullup"] },
    { canonicalName: "lat pulldown", bucket: "vertical_pull", equipment: "cable", bodyweight: false, normFactor: 0.7, aliases: ["lat pull down", "pulldown", "lat pulldowns"] },
    { canonicalName: "weighted pull-ups", bucket: "vertical_pull", equipment: "bodyweight", bodyweight: true, normFactor: 1.2, aliases: ["weighted pullups", "weighted pull ups"] },
    { canonicalName: "squat", bucket: "squat", equipment: "barbell", bodyweight: false, normFactor: 1.0, aliases: ["back squat", "barbell squat", "bb squat", "squats"] },
    { canonicalName: "front squat", bucket: "squat", equipment: "barbell", bodyweight: false, normFactor: 0.85, aliases: ["front squats"] },
    { canonicalName: "leg press", bucket: "quad", equipment: "machine", bodyweight: false, normFactor: 0.5, aliases: ["leg press machine"] },
    { canonicalName: "deadlift", bucket: "hinge", equipment: "barbell", bodyweight: false, normFactor: 1.0, aliases: ["conventional deadlift", "dl"] },
    { canonicalName: "romanian deadlift", bucket: "hamstring", equipment: "barbell", bodyweight: false, normFactor: 0.75, aliases: ["rdl", "romanian dl", "stiff leg deadlift"] },
    { canonicalName: "leg curl", bucket: "hamstring", equipment: "machine", bodyweight: false, normFactor: 0.4, aliases: ["hamstring curl", "leg curls", "lying leg curl"] },
    { canonicalName: "calf raise", bucket: "calf", equipment: "machine", bodyweight: false, normFactor: 1.0, aliases: ["calf raises", "standing calf raise", "calf press"] },
    { canonicalName: "barbell curl", bucket: "biceps", equipment: "barbell", bodyweight: false, normFactor: 1.0, aliases: ["bb curl", "curls", "bicep curl", "bicep curls"] },
    { canonicalName: "dumbbell curl", bucket: "biceps", equipment: "dumbbell", bodyweight: false, normFactor: 0.5, aliases: ["db curl", "db curls", "hammer curl"] },
    { canonicalName: "tricep pushdown", bucket: "triceps", equipment: "cable", bodyweight: false, normFactor: 1.0, aliases: ["pushdown", "tricep pushdowns", "rope pushdown"] },
    { canonicalName: "skull crusher", bucket: "triceps", equipment: "barbell", bodyweight: false, normFactor: 0.8, aliases: ["skull crushers", "lying tricep extension"] },
    { canonicalName: "plank", bucket: "abs_core", equipment: "bodyweight", bodyweight: true, normFactor: 1.0, aliases: ["planks", "front plank"] },
    { canonicalName: "running", bucket: "run_cardio", equipment: "bodyweight", bodyweight: true, normFactor: 1.0, aliases: ["run", "jog", "jogging", "treadmill"] },
    { canonicalName: "walking", bucket: "run_cardio", equipment: "bodyweight", bodyweight: true, normFactor: 0.3, aliases: ["walk", "walking", "weighted walk"] },
  ];

  const exercises: Record<string, { id: string }> = {};
  for (const ex of exerciseData) {
    const created = await prisma.exercise.create({
      data: {
        canonicalName: ex.canonicalName,
        primaryBucketId: buckets[ex.bucket].id,
        equipmentType: ex.equipment,
        isBodyweightRelevant: ex.bodyweight,
        normalizationFactor: ex.normFactor,
        aliases: {
          create: ex.aliases.map(a => ({ alias: a })),
        },
      },
    });
    exercises[ex.canonicalName] = created;
  }

  // Helper to create a date N days ago
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(8, 0, 0, 0);
    return d;
  };

  // Sample workouts
  const workouts = [
    {
      date: daysAgo(28),
      type: "strength",
      exercises: [
        { name: "bench press", sets: [{ w: 135, r: 8 }, { w: 155, r: 5 }, { w: 155, r: 5 }, { w: 155, r: 5 }] },
        { name: "incline dumbbell press", sets: [{ w: 50, r: 10 }, { w: 50, r: 10 }, { w: 50, r: 8 }] },
        { name: "tricep pushdown", sets: [{ w: 50, r: 12 }, { w: 50, r: 12 }, { w: 50, r: 10 }] },
      ],
    },
    {
      date: daysAgo(26),
      type: "strength",
      exercises: [
        { name: "squat", sets: [{ w: 185, r: 5 }, { w: 225, r: 5 }, { w: 225, r: 5 }, { w: 225, r: 3 }] },
        { name: "romanian deadlift", sets: [{ w: 155, r: 8 }, { w: 155, r: 8 }, { w: 155, r: 8 }] },
        { name: "calf raise", sets: [{ w: 200, r: 15 }, { w: 200, r: 15 }, { w: 200, r: 12 }] },
      ],
    },
    {
      date: daysAgo(21),
      type: "strength",
      exercises: [
        { name: "overhead press", sets: [{ w: 95, r: 5 }, { w: 105, r: 5 }, { w: 105, r: 4 }] },
        { name: "lateral raise", sets: [{ w: 20, r: 15 }, { w: 20, r: 12 }, { w: 20, r: 12 }] },
        { name: "barbell row", sets: [{ w: 155, r: 8 }, { w: 155, r: 8 }, { w: 155, r: 6 }] },
        { name: "barbell curl", sets: [{ w: 65, r: 10 }, { w: 65, r: 8 }] },
      ],
    },
    {
      date: daysAgo(18),
      type: "strength",
      exercises: [
        { name: "bench press", sets: [{ w: 135, r: 8 }, { w: 165, r: 5 }, { w: 165, r: 5 }, { w: 165, r: 4 }] },
        { name: "machine chest press", sets: [{ w: 140, r: 10 }, { w: 140, r: 10 }, { w: 140, r: 8 }] },
        { name: "skull crusher", sets: [{ w: 55, r: 10 }, { w: 55, r: 10 }] },
      ],
    },
    {
      date: daysAgo(14),
      type: "strength",
      exercises: [
        { name: "squat", sets: [{ w: 195, r: 5 }, { w: 235, r: 5 }, { w: 235, r: 5 }, { w: 235, r: 5 }] },
        { name: "leg press", sets: [{ w: 360, r: 10 }, { w: 360, r: 10 }, { w: 360, r: 8 }] },
        { name: "leg curl", sets: [{ w: 90, r: 12 }, { w: 90, r: 12 }, { w: 90, r: 10 }] },
      ],
    },
    {
      date: daysAgo(10),
      type: "strength",
      exercises: [
        { name: "pull-ups", sets: [{ w: 0, r: 8, bw: true }, { w: 0, r: 7, bw: true }, { w: 0, r: 6, bw: true }] },
        { name: "barbell row", sets: [{ w: 165, r: 8 }, { w: 165, r: 8 }, { w: 165, r: 7 }] },
        { name: "dumbbell curl", sets: [{ w: 30, r: 12 }, { w: 30, r: 10 }] },
        { name: "overhead press", sets: [{ w: 95, r: 5 }, { w: 110, r: 4 }, { w: 110, r: 3 }] },
      ],
    },
    {
      date: daysAgo(5),
      type: "strength",
      exercises: [
        { name: "bench press", sets: [{ w: 135, r: 8 }, { w: 175, r: 3 }, { w: 175, r: 3 }, { w: 175, r: 2 }] },
        { name: "incline dumbbell press", sets: [{ w: 55, r: 10 }, { w: 55, r: 8 }, { w: 55, r: 7 }] },
        { name: "lateral raise", sets: [{ w: 25, r: 12 }, { w: 25, r: 12 }] },
      ],
    },
    {
      date: daysAgo(2),
      type: "strength",
      exercises: [
        { name: "deadlift", sets: [{ w: 225, r: 5 }, { w: 275, r: 3 }, { w: 275, r: 3 }] },
        { name: "squat", sets: [{ w: 205, r: 5 }, { w: 245, r: 3 }, { w: 245, r: 3 }] },
        { name: "calf raise", sets: [{ w: 220, r: 15 }, { w: 220, r: 12 }] },
      ],
    },
  ];

  for (const wo of workouts) {
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        date: wo.date,
        startedAt: wo.date,
        endedAt: new Date(wo.date.getTime() + 60 * 60 * 1000),
        sessionType: wo.type,
        exercises: {
          create: wo.exercises.map((ex, i) => ({
            exerciseId: exercises[ex.name].id,
            displayNameUsed: ex.name,
            orderIndex: i,
            sets: {
              create: ex.sets.map((s, j) => ({
                setIndex: j,
                setType: j === 0 && s.w < (ex.sets[1]?.w || s.w) ? "warmup" : "working",
                weight: s.w,
                reps: s.r,
                totalLoad: s.w * s.r,
              })),
            },
          })),
        },
      },
    });
  }

  // Bodyweight entries
  const bwEntries = [
    { days: 28, weight: 170.2 },
    { days: 25, weight: 169.8 },
    { days: 21, weight: 170.0 },
    { days: 18, weight: 169.5 },
    { days: 14, weight: 168.8 },
    { days: 10, weight: 169.0 },
    { days: 7, weight: 168.4 },
    { days: 5, weight: 168.6 },
    { days: 2, weight: 168.2 },
    { days: 0, weight: 168.0 },
  ];

  for (const bw of bwEntries) {
    await prisma.bodyweightEntry.create({
      data: { userId: user.id, date: daysAgo(bw.days), weight: bw.weight },
    });
  }

  // Context events
  await prisma.contextEvent.create({
    data: { userId: user.id, date: daysAgo(23), type: "illness", note: "Cold, skipped 2 days" },
  });
  await prisma.contextEvent.create({
    data: { userId: user.id, date: daysAgo(8), type: "low_energy", value: "5", note: "Slept 5 hours" },
  });
  await prisma.contextEvent.create({
    data: { userId: user.id, date: daysAgo(16), type: "travel", note: "Work trip, limited gym access" },
  });

  console.log("Seed complete!");
  console.log(`Created: ${Object.keys(exercises).length} exercises, ${workouts.length} sessions, ${bwEntries.length} bodyweight entries`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
