import { getPrismaClient, ProcessingStatus } from "@repo/db";
import type { CreateRecordedSetValues } from "@repo/common";

import { BadRequestError, NotFoundError } from "../errors";

import { normalizeString } from "../utils/normalizeString";
import { lookAheadTake, paginate } from "../utils/pagination";
import { parseOptionalDate } from "../utils/parseDate";
import { getUserIdByUuid } from "../utils/getUserIdByUuid";

import aiPrerequisitesService from "./aiPrerequisitesService";
import workoutPlanService from "./workoutPlanService";

type ListRecordedSetsInput = {
  userUuid: string;
  limit: number;
  offset: number;
  exerciseCode?: string;
  processingStatus?: ProcessingStatus;
};

export class RecordedSetService {
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

  private async assertWorkoutPlanContainsExercise(
    userId: number,
    workoutPlanId: number,
    exerciseCode: string,
  ) {
    const workout = await this.prisma.workoutPlan.findFirst({
      where: { id: workoutPlanId, userId },
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

  async createRecordedSet(userUuid: string, data: CreateRecordedSetValues) {
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    await aiPrerequisitesService.assertAiPrerequisites(userId);

    const exerciseCode = normalizeString(data.exerciseCode);
    const exercise = await this.getExerciseByCode(exerciseCode);

    if (data.workoutPlanId !== undefined) {
      await this.assertWorkoutPlanContainsExercise(
        userId,
        data.workoutPlanId,
        exercise.code,
      );
      if (data.workoutRunId !== undefined) {
        await workoutPlanService.assertOpenWorkoutRun(
          userId,
          data.workoutPlanId,
          data.workoutRunId,
        );
      }
    }

    const performedAt = parseOptionalDate(data.performedAt, "performedAt");

    const recordedSet = await this.prisma.recordedSet.create({
      data: {
        userId,
        exerciseId: exercise.id,
        workoutPlanId: data.workoutPlanId ?? null,
        workoutRunId: data.workoutRunId ?? null,
        setNumber: data.setNumber ?? null,
        notes: data.notes,
        performedAt,
        processingStatus: ProcessingStatus.PENDING,
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

    return recordedSet;
  }

  async listRecordedSets(input: ListRecordedSetsInput) {
    const { userUuid, limit, offset, exerciseCode, processingStatus } = input;
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    const normalizedExerciseCode = exerciseCode
      ? normalizeString(exerciseCode)
      : undefined;

    const recordedSets = await this.prisma.recordedSet.findMany({
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

    return paginate(recordedSets, limit, offset);
  }
}

export default new RecordedSetService();
