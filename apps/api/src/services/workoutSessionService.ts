import { getPrismaClient, SessionStatus } from "@repo/db";
import { CreateWorkoutSessionValues } from "@repo/common";

import NotFoundError from "../errors/NotFoundError";

import { normalizeString } from "../utils/normalizeString";
import { lookAheadTake, paginate } from "../utils/pagination";
import { parseOptionalDate } from "../utils/parseDate";
import { getUserIdByUuid } from "../utils/getUserIdByUuid";

type ListWorkoutSessionsInput = {
  userUuid: string;
  limit: number;
  offset: number;
  exerciseCode?: string;
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

  async createSession(userUuid: string, data: CreateWorkoutSessionValues) {
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    const exerciseCode = normalizeString(data.exerciseCode);
    const exercise = await this.getExerciseByCode(exerciseCode);

    const performedAt = parseOptionalDate(data.performedAt, "performedAt");

    const session = await this.prisma.workoutSession.create({
      data: {
        userId,
        exerciseId: exercise.id,
        notes: data.notes,
        performedAt,
        processingStatus: SessionStatus.PENDING,
        videoDurationSec: data.videoMeta?.durationSec ?? null,
        videoFps: data.videoMeta?.fps ?? null,
        videoWidth: data.videoMeta?.width ?? null,
        videoHeight: data.videoMeta?.height ?? null,
        videoSizeBytes: data.videoMeta?.sizeBytes ?? null,
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
    const { userUuid, limit, offset, exerciseCode } = input;
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
            formScore: true,
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
