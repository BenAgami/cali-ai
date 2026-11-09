import { randomUUID } from "node:crypto";
import type { z } from "zod";

import type {
  captureAcceptedResponseSchema,
  PoseCapturePayload,
} from "@repo/common";
import { getPrismaClient, SessionStatus } from "@repo/db";

import { env } from "../config/env";
import {
  ConflictError,
  ServiceUnavailableError,
  TooManyRequestsError,
} from "../errors";
import { logger } from "../lib/logger";
import { ANALYSIS_JOB_NAME, formAnalysisQueue } from "../lib/queue";
import { encodeCapture, KEYPOINTS_FORMAT } from "../utils/captureCodec";
import { getUserIdByUuid } from "../utils/getUserIdByUuid";
import { toError } from "../utils/toError";
import { withTimeout } from "../utils/withTimeout";

import aiPrerequisitesService from "./aiPrerequisitesService";
import analysisStateService from "./analysisStateService";

type CaptureAcceptedData = z.infer<typeof captureAcceptedResponseSchema>;

const ENQUEUE_TIMEOUT_MS = 5_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const newJobId = (): string => `analysis-${randomUUID()}`;

/**
 * Accepts a pose capture and queues it for analysis. Nothing heavy happens
 * here: the worker decodes the keypoints, computes metrics and calls the LLM.
 */
export class CaptureService {
  private get prisma() {
    return getPrismaClient();
  }

  async submitCapture(
    userUuid: string,
    sessionId: number,
    payload: PoseCapturePayload,
  ): Promise<CaptureAcceptedData> {
    const session = await analysisStateService.findOwnedSession(
      userUuid,
      sessionId,
    );

    if (session.processingStatus === SessionStatus.FAILED) {
      throw new ConflictError("Analysis failed; retry the analysis");
    }
    if (session.processingStatus !== SessionStatus.PENDING) {
      throw new ConflictError("Analysis already started for this session");
    }

    const userId = await getUserIdByUuid(this.prisma, userUuid);
    await aiPrerequisitesService.assertAiPrerequisites(userId);
    await this.assertUnderDailyCap(userId);
    await this.assertUnderExerciseWorkoutCap(userId, sessionId);

    const keypoints = await encodeCapture(payload);
    const jobId = newJobId();
    const { captureId } = await analysisStateService.startRunWithCapture(
      sessionId,
      {
        keypoints,
        keypointsFormat: KEYPOINTS_FORMAT,
        poseModelName: payload.poseModelName,
        poseModelVersion: payload.poseModelVersion,
        fps: payload.fps,
        frameCount: payload.frameCount,
        durationSec: payload.durationSec,
        cameraView: payload.cameraView ?? null,
        deviceModel: payload.deviceModel ?? null,
        appVersion: payload.appVersion ?? null,
      },
      jobId,
    );

    await this.enqueue(sessionId, captureId, jobId);
    return { sessionId, captureId, jobId, status: "QUEUED" };
  }

  async retryAnalysis(
    userUuid: string,
    sessionId: number,
  ): Promise<CaptureAcceptedData> {
    const session = await analysisStateService.findOwnedSession(
      userUuid,
      sessionId,
    );
    if (session.processingStatus !== SessionStatus.FAILED) {
      throw new ConflictError("Only failed analyses can be retried");
    }

    const userId = await getUserIdByUuid(this.prisma, userUuid);
    await aiPrerequisitesService.assertAiPrerequisites(userId);

    const jobId = newJobId();
    const { captureId } = await analysisStateService.restartRun(
      sessionId,
      jobId,
    );

    await this.enqueue(sessionId, captureId, jobId);
    return { sessionId, captureId, jobId, status: "QUEUED" };
  }

  private async assertUnderDailyCap(userId: number): Promise<void> {
    const acceptedLast24hCount = await this.prisma.poseCapture.count({
      where: {
        session: { userId },
        createdAt: { gte: new Date(Date.now() - DAY_MS) },
      },
    });
    if (acceptedLast24hCount >= env.formAnalysis.dailyCap) {
      throw new TooManyRequestsError(
        "You've reached today's limit for form analysis. Try again tomorrow.",
        "DAILY_ANALYSIS_LIMIT_REACHED",
      );
    }
  }

  /** Retries reuse the stored capture row, so they never count here. */
  private async assertUnderExerciseWorkoutCap(
    userId: number,
    sessionId: number,
  ): Promise<void> {
    const session = await this.prisma.workoutSession.findUnique({
      where: { id: sessionId },
      select: { workoutId: true, exerciseId: true },
    });
    if (!session?.workoutId) return;

    const acceptedCount = await this.prisma.poseCapture.count({
      where: {
        session: {
          userId,
          workoutId: session.workoutId,
          exerciseId: session.exerciseId,
        },
      },
    });
    if (acceptedCount >= env.formAnalysis.exerciseWorkoutCap) {
      throw new TooManyRequestsError(
        "You've already analysed this exercise twice in this workout.",
        "EXERCISE_ANALYSIS_LIMIT_REACHED",
      );
    }
  }

  /**
   * `IORedis` with `maxRetriesPerRequest: null` queues commands forever while
   * Redis is down, so the add is bounded; on failure the run is failed so the
   * session never sits in PROCESSING with no job.
   */
  private async enqueue(
    sessionId: number,
    captureId: number,
    jobId: string,
  ): Promise<void> {
    try {
      await withTimeout(
        formAnalysisQueue.add(
          ANALYSIS_JOB_NAME,
          { sessionId, captureId },
          { jobId },
        ),
        ENQUEUE_TIMEOUT_MS,
        "ENQUEUE_TIMEOUT",
      );
    } catch (error) {
      logger.error(
        { err: toError(error), sessionId, jobId },
        "Failed to enqueue analysis job",
      );
      await analysisStateService.failRun(sessionId, jobId, "ENQUEUE_FAILED");
      throw new ServiceUnavailableError(
        "Analysis queue is unavailable, please retry shortly",
      );
    }
  }
}

export default new CaptureService();
