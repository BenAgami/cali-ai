import { getPrismaClient } from "@repo/db";

import NotFoundError from "../errors/NotFoundError";

type ListExercisesInput = {
  limit: number;
  offset: number;
  includeInactive: boolean;
};

export class ExerciseService {
  private get prisma() {
    return getPrismaClient();
  }

  private normalizeExerciseCode(code: string) {
    return code.trim().toLowerCase();
  }

  async listExercises(input: ListExercisesInput) {
    const { limit, offset, includeInactive } = input;

    const exercises = await this.prisma.exercise.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      skip: offset,
      take: limit + 1,
    });

    const hasMore = exercises.length > limit;
    const items = hasMore ? exercises.slice(0, limit) : exercises;

    return {
      items,
      page: {
        limit,
        offset,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
      },
    };
  }

  async getExerciseByCode(code: string) {
    const normalizedCode = this.normalizeExerciseCode(code);

    const exercise = await this.prisma.exercise.findFirst({
      where: { code: normalizedCode, isActive: true },
    });

    if (!exercise) {
      throw new NotFoundError("Exercise not found");
    }

    return exercise;
  }
}

export default new ExerciseService();
