/* eslint-disable no-console */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ExerciseType } from "../generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });

const exercises = [
  {
    code: "push_up",
    displayName: "Push Up",
    exerciseType: ExerciseType.DYNAMIC,
    description:
      "Upper body push exercise focusing on chest, shoulders, and triceps.",
  },
  {
    code: "pull_up",
    displayName: "Pull Up",
    exerciseType: ExerciseType.DYNAMIC,
    description: "Upper body pull exercise focusing on lats, back, and biceps.",
  },
  {
    code: "squat",
    displayName: "Squat",
    exerciseType: ExerciseType.DYNAMIC,
    description:
      "Lower body exercise focusing on quads, glutes, and core stability.",
  },
  {
    code: "plank",
    displayName: "Plank",
    exerciseType: ExerciseType.STATIC_HOLD,
    description:
      "Core stability hold focusing on full-body tension and posture.",
  },
];

async function main() {
  for (const exercise of exercises) {
    await prisma.exercise.upsert({
      where: { code: exercise.code },
      update: {
        displayName: exercise.displayName,
        exerciseType: exercise.exerciseType,
        description: exercise.description,
        isActive: true,
      },
      create: {
        ...exercise,
        isActive: true,
      },
    });
  }
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
