import { getPrismaClient } from "@repo/db";
import type {
  CreateWorkoutValues,
  UpdateWorkoutValues,
  WorkoutLogValues,
  WorkoutExerciseInput,
} from "@repo/common";

import NotFoundError from "../errors/NotFoundError";
import BadRequestError from "../errors/BadRequestError";

import { lookAheadTake, paginate } from "../utils/pagination";
import { parseOptionalDate } from "../utils/parseDate";
import { getUserIdByUuid } from "../utils/getUserIdByUuid";

type ListWorkoutsInput = {
  userUuid: string;
  limit: number;
  offset: number;
};

const workoutInclude = {
  exercises: {
    include: {
      exercise: {
        select: {
          id: true,
          code: true,
          displayName: true,
          exerciseType: true,
        },
      },
    },
    orderBy: { position: "asc" as const },
  },
};

export class WorkoutService {
  private get prisma() {
    return getPrismaClient();
  }

  private validateExerciseInput(input: WorkoutExerciseInput): void {
    const hasReps = !!input.reps;
    const hasDuration = !!input.durationSecs;
    if (hasReps && hasDuration) {
      throw new BadRequestError("Cannot specify both reps and durationSecs");
    }
    if (!hasReps && !hasDuration) {
      throw new BadRequestError(
        "Either reps or durationSecs must be specified",
      );
    }
  }

  private async assertExercisesExist(ids: number[]): Promise<void> {
    const uniqueIds = Array.from(new Set(ids));
    const found = await this.prisma.exercise.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (found.length !== uniqueIds.length) {
      throw new NotFoundError("Exercise not found");
    }
  }

  async listWorkouts(input: ListWorkoutsInput) {
    const userId = await getUserIdByUuid(this.prisma, input.userUuid);
    const workouts = await this.prisma.workout.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: input.offset,
      take: lookAheadTake(input.limit),
      include: workoutInclude,
    });

    return paginate(workouts, input.limit, input.offset);
  }

  async getWorkoutById(userUuid: string, workoutId: number) {
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
      include: workoutInclude,
    });
    if (!workout) throw new NotFoundError("Workout not found");
    return workout;
  }

  async createWorkout(userUuid: string, data: CreateWorkoutValues) {
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    data.exercises.forEach((ex) => this.validateExerciseInput(ex));
    await this.assertExercisesExist(data.exercises.map((ex) => ex.exerciseId));

    const workout = await this.prisma.workout.create({
      data: {
        userId,
        name: data.name,
        exercises: {
          create: data.exercises.map((ex, idx) => ({
            exerciseId: ex.exerciseId,
            position: idx,
            sets: ex.sets,
            reps: ex.reps ?? null,
            durationSecs: ex.durationSecs ?? null,
            restSecs: ex.restSecs,
          })),
        },
      },
      include: workoutInclude,
    });
    return workout;
  }

  async updateWorkout(
    userUuid: string,
    workoutId: number,
    data: UpdateWorkoutValues,
  ) {
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    const existing = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Workout not found");

    if (data.exercises) {
      data.exercises.forEach((ex) => this.validateExerciseInput(ex));
      await this.assertExercisesExist(
        data.exercises.map((ex) => ex.exerciseId),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.name !== undefined) {
        await tx.workout.update({
          where: { id: workoutId },
          data: { name: data.name },
        });
      }

      if (data.exercises) {
        await tx.workoutExercise.deleteMany({ where: { workoutId } });
        await tx.workoutExercise.createMany({
          data: data.exercises.map((ex, idx) => ({
            workoutId,
            exerciseId: ex.exerciseId,
            position: idx,
            sets: ex.sets,
            reps: ex.reps ?? null,
            durationSecs: ex.durationSecs ?? null,
            restSecs: ex.restSecs,
          })),
        });
      }

      const updated = await tx.workout.findUnique({
        where: { id: workoutId },
        include: workoutInclude,
      });
      if (!updated) throw new NotFoundError("Workout not found");
      return updated;
    });
  }

  async deleteWorkout(userUuid: string, workoutId: number): Promise<void> {
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    const existing = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Workout not found");
    await this.prisma.workout.delete({ where: { id: workoutId } });
  }

  async startWorkoutLog(
    userUuid: string,
    workoutId: number,
    data: WorkoutLogValues,
  ) {
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
      select: { id: true },
    });
    if (!workout) throw new NotFoundError("Workout not found");

    const completedAt = parseOptionalDate(data.completedAt, "completedAt");

    return this.prisma.workoutLog.create({
      data: {
        userId,
        workoutId,
        durationSecs: data.durationSecs,
        ...(completedAt ? { completedAt } : {}),
      },
    });
  }
}

export default new WorkoutService();
