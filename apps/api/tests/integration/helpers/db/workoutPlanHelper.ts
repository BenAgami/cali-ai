import type { getPrismaClient } from "@repo/db";

type CreateWorkoutPlanFixtureInput = {
  userId: number;
  name?: string;
  exercises: Array<{
    exerciseId: number;
    position: number;
    sets?: number;
    reps?: number | null;
    durationSecs?: number | null;
    restSecs?: number;
  }>;
};

export const createWorkoutPlanFixture = async (
  prisma: ReturnType<typeof getPrismaClient>,
  input: CreateWorkoutPlanFixtureInput,
) => {
  return prisma.workoutPlan.create({
    data: {
      userId: input.userId,
      name: input.name ?? "Test Workout",
      exercises: {
        create: input.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          position: ex.position,
          sets: ex.sets ?? 3,
          reps: ex.reps ?? null,
          durationSecs: ex.durationSecs ?? null,
          restSecs: ex.restSecs ?? 60,
        })),
      },
    },
    include: {
      exercises: { include: { exercise: true }, orderBy: { position: "asc" } },
    },
  });
};
