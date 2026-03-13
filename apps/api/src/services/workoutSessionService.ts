import { getPrismaClient, SessionStatus } from "@repo/db";
import { CreateWorkoutSessionValues } from "@repo/common";

import NotFoundError from "../errors/NotFoundError";
import BadRequestError from "../errors/BadRequestError";

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

  private normalizeExerciseCode(code: string) {
    return code.trim().toLowerCase();
  }

  private async getUserIdByUuid(uuid: string) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user.id;
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
    const userId = await this.getUserIdByUuid(userUuid);
    const exerciseCode = this.normalizeExerciseCode(data.exerciseCode);
    const exercise = await this.getExerciseByCode(exerciseCode);

    const performedAt = data.performedAt
      ? new Date(data.performedAt)
      : undefined;
    if (performedAt && Number.isNaN(performedAt.getTime())) {
      throw new BadRequestError("Invalid performedAt value");
    }

    const session = await this.prisma.workoutSession.create({
      data: {
        userId,
        exerciseId: exercise.id,
        notes: data.notes,
        performedAt,
        processingStatus: SessionStatus.PENDING,
        videoDurationSec: data.videoMeta?.durationSec,
        videoFps: data.videoMeta?.fps,
        videoWidth: data.videoMeta?.width,
        videoHeight: data.videoMeta?.height,
        videoSizeBytes: data.videoMeta?.sizeBytes,
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
    const safeLimit = Math.min(limit, 50);
    const userId = await this.getUserIdByUuid(userUuid);
    const normalizedExerciseCode = exerciseCode
      ? this.normalizeExerciseCode(exerciseCode)
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
      take: safeLimit + 1,
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

    const hasMore = sessions.length > safeLimit;
    const items = hasMore ? sessions.slice(0, safeLimit) : sessions;

    return {
      items,
      page: {
        limit,
        offset,
        hasMore,
        nextOffset: hasMore ? offset + safeLimit : null,
      },
    };
  }
}

export default new WorkoutSessionService();
