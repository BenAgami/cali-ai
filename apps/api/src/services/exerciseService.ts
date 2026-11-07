import { getPrismaClient } from "@repo/db";

import { NotFoundError } from "../errors";

import { normalizeString } from "../utils/normalizeString";
import { lookAheadTake, paginate } from "../utils/pagination";

type ListExercisesInput = {
  limit: number;
  offset: number;
  shouldIncludeInactive: boolean;
};

export class ExerciseService {
  private get prisma() {
    return getPrismaClient();
  }

  async listExercises(input: ListExercisesInput) {
    const { limit, offset, shouldIncludeInactive } = input;

    const exercises = await this.prisma.exercise.findMany({
      where: shouldIncludeInactive ? {} : { isActive: true },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      skip: offset,
      take: lookAheadTake(limit),
    });

    return paginate(exercises, limit, offset);
  }

  async getExerciseByCode(code: string, shouldIncludeInactive = false) {
    const normalizedCode = normalizeString(code);

    const exercise = await this.prisma.exercise.findFirst({
      where: {
        code: normalizedCode,
        ...(shouldIncludeInactive ? {} : { isActive: true }),
      },
    });

    if (!exercise) {
      throw new NotFoundError("Exercise not found");
    }

    return exercise;
  }
}

export default new ExerciseService();
