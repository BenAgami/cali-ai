import { getPrismaClient, SessionStatus } from "@repo/db";
import type { CreateWorkoutSessionValues } from "@repo/common";

import { BadRequestError, NotFoundError } from "../errors";

import { normalizeString } from "../utils/normalizeString";
import { lookAheadTake, paginate } from "../utils/pagination";
import { parseOptionalDate } from "../utils/parseDate";
import { getUserIdByUuid } from "../utils/getUserIdByUuid";

import aiPrerequisitesService from "./aiPrerequisitesService";

type ListWorkoutSessionsInput = {
  userUuid: string;
  limit: number;
  offset: number;
  exerciseCode?: string;
  processingStatus?: SessionStatus;
};

export class WorkoutSessionService {
  private get prisma() {
    return getPrismaClient();
  }

  private async getExerciseByCode(code: string) {
    const exercise = await this.prisma.exercise.findFirst({
      where: { code, isActive: true },
      select: {
        id: true,
        code: true,
        displayName: true,
        exerciseType: true,
      },
    });

    if (!exercise) {
      throw new NotFoundError("Exercise not found");
    }

    return exercise;
  }

  private async assertWorkoutContainsExercise(
    userId: number,
    workoutId: number,
    exerciseCode: string,
  ) {
    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
      select: {
        id: true,
        exercises: { select: { exercise: { select: { code: true } } } },
      },
    });

    if (!workout) {
      throw new NotFoundError("Workout not found");
    }

    if (!workout.exercises.some((we) => we.exercise.code === exerciseCode)) {
      throw new BadRequestError("Exercise is not part of this workout");
    }
  }

  async createSession(userUuid: string, data: CreateWorkoutSessionValues) {
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    await aiPrerequisitesService.assertAiPrerequisites(userId);

    const exerciseCode = normalizeString(data.exerciseCode);
    const exercise = await this.getExerciseByCode(exerciseCode);

    if (data.workoutId !== undefined) {
      await this.assertWorkoutContainsExercise(
        userId,
        data.workoutId,
        exercise.code,
      );
    }

    const performedAt = parseOptionalDate(data.performedAt, "performedAt");

    const session = await this.prisma.workoutSession.create({
      data: {
        userId,
        exerciseId: exercise.id,
        workoutId: data.workoutId ?? null,
        setNumber: data.setNumber ?? null,
        notes: data.notes,
        performedAt,
        processingStatus: SessionStatus.PENDING,
      },
      include: {
        exercise: {
          select: {
            code: true,
            displayName: true,
            exerciseType: true,
          },
        },
      },
    });

    return session;
  }

  async listSessions(input: ListWorkoutSessionsInput) {
    const { userUuid, limit, offset, exerciseCode, processingStatus } = input;
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    const normalizedExerciseCode = exerciseCode
      ? normalizeString(exerciseCode)
      : undefined;

    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        userId,
        ...(normalizedExerciseCode
          ? { exercise: { code: normalizedExerciseCode } }
          : {}),
        ...(processingStatus ? { processingStatus } : {}),
      },
      orderBy: [{ performedAt: "desc" }, { id: "desc" }],
      skip: offset,
      take: lookAheadTake(limit),
      include: {
        exercise: {
          select: {
            code: true,
            displayName: true,
            exerciseType: true,
          },
        },
        analysisResult: {
          select: {
            outcome: true,
            analyzedAt: true,
            summaryFeedback: true,
          },
        },
      },
    });

    return paginate(sessions, limit, offset);
  }
}

export default new WorkoutSessionService();
