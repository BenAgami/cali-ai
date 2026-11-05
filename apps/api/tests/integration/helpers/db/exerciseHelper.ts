import type { getPrismaClient } from "@repo/db";

import {
  ExerciseBuilder,
  type ExerciseDto,
} from "../../builders/exerciseBuilder";

export const createExercise = async (
  prisma: ReturnType<typeof getPrismaClient>,
  overrides?: Partial<ExerciseDto>,
) => {
  const exerciseData: ExerciseDto = {
    ...new ExerciseBuilder().build(),
    ...overrides,
  };

  return prisma.exercise.create({
    data: exerciseData,
  });
};
