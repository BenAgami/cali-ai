import { getPrismaClient } from "@repo/db";
import {
  API_ERROR_CODES,
  type CreateWorkoutValues,
  type UpdateWorkoutValues,
  type WorkoutExerciseInput,
} from "@repo/common";

import { NotFoundError, BadRequestError, ConflictError } from "../errors";
import {
  isPrismaKnownRequestError,
  PrismaErrorCode,
} from "../utils/prismaErrorCodes";

import { lookAheadTake, paginate } from "../utils/pagination";
import { getUserIdByUuid } from "../utils/getUserIdByUuid";

const SECOND_MS = 1000;
/** A Start within this long of an unfinished run resumes it. */
const RUN_RESUME_WINDOW_MS = 3 * 60 * 60 * SECOND_MS;
const WORKOUT_LOG_COMPLETED_MESSAGE = "Workout log is already completed";

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

    let provenance: { aiModel: string; generationId: number } | undefined;
    if (data.generationId !== undefined) {
      const generation = await this.prisma.workoutGeneration.findFirst({
        where: { id: data.generationId, userId, status: "SUCCEEDED" },
        select: { id: true, model: true },
      });
      if (!generation?.model) throw new NotFoundError("Generation not found");
      provenance = { aiModel: generation.model, generationId: generation.id };
    }

    try {
      return await this.prisma.workout.create({
        data: {
          userId,
          name: data.name,
          ...(provenance ?? {}),
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
    } catch (error) {
      if (
        isPrismaKnownRequestError(error) &&
        error.code === PrismaErrorCode.UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictError(
          "This generated workout was already saved",
          "GENERATION_ALREADY_SAVED",
        );
      }
      throw error;
    }
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

  /**
   * Starting a plan opens a run that stays in progress until completed. A run
   * left open within the resume window (the user backed out) is resumed rather
   * than duplicated; an older open run with no recorded sets holds nothing, so
   * it is deleted instead of piling up.
   */
  async startWorkoutLog(userUuid: string, workoutId: number) {
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
      select: { id: true },
    });
    if (!workout) throw new NotFoundError("Workout not found");

    const resumeCutoff = new Date(Date.now() - RUN_RESUME_WINDOW_MS);
    const openRun = { userId, workoutId, completedAt: null };
    await this.prisma.workoutLog.deleteMany({
      where: {
        ...openRun,
        startedAt: { lt: resumeCutoff },
        sessions: { none: {} },
      },
    });
    const resumable = await this.prisma.workoutLog.findFirst({
      where: { ...openRun, startedAt: { gte: resumeCutoff } },
      orderBy: { startedAt: "desc" },
    });

    return (
      resumable ??
      this.prisma.workoutLog.create({ data: { userId, workoutId } })
    );
  }

  /** The run must be the user's, for that workout, and not yet completed. */
  async assertOpenWorkoutLog(
    userId: number,
    workoutId: number,
    logId: number,
  ): Promise<{ startedAt: Date }> {
    const log = await this.prisma.workoutLog.findFirst({
      where: { id: logId, workoutId, userId },
      select: { startedAt: true, completedAt: true },
    });
    if (!log) throw new NotFoundError("Workout log not found");
    if (log.completedAt !== null) {
      throw new ConflictError(
        WORKOUT_LOG_COMPLETED_MESSAGE,
        API_ERROR_CODES.WORKOUT_LOG_COMPLETED,
      );
    }
    return { startedAt: log.startedAt };
  }

  /** The duration is the server's startedAt to completedAt, not a client clock. */
  async completeWorkoutLog(userUuid: string, workoutId: number, logId: number) {
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    const { startedAt } = await this.assertOpenWorkoutLog(
      userId,
      workoutId,
      logId,
    );

    const completedAt = new Date();
    const durationSecs = Math.max(
      0,
      Math.round((completedAt.getTime() - startedAt.getTime()) / SECOND_MS),
    );

    // Guarded on completedAt so a concurrent request cannot complete it twice.
    const { count } = await this.prisma.workoutLog.updateMany({
      where: { id: logId, completedAt: null },
      data: { completedAt, durationSecs },
    });
    if (count === 0) {
      throw new ConflictError(
        WORKOUT_LOG_COMPLETED_MESSAGE,
        API_ERROR_CODES.WORKOUT_LOG_COMPLETED,
      );
    }

    return this.prisma.workoutLog.findUniqueOrThrow({ where: { id: logId } });
  }
}

export default new WorkoutService();
