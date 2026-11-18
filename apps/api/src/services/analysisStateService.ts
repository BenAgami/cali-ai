import { getPrismaClient, SessionStatus, type Prisma } from "@repo/db";
import {
  ANALYSIS_LIMIT_MESSAGES,
  API_ERROR_CODES,
  type AnalysisFailureReason,
  type AnalysisStage,
  type AnalysisStatusEvent,
} from "@repo/common";

import { env } from "../config/env";
import { ConflictError, NotFoundError, TooManyRequestsError } from "../errors";
import { publishAnalysisEvent } from "../lib/progressBus";
import { logger, type Logger } from "../lib/logger";

import {
  progressPercent,
  toStatusEvent,
  type AnalysisSnapshot,
} from "../utils/analysisProgress";
import { getUserIdByUuid } from "../utils/getUserIdByUuid";
import {
  isPrismaKnownRequestError,
  PrismaErrorCode,
} from "../utils/prismaErrorCodes";
import { toError } from "../utils/toError";

export type CaptureInsert = {
  keypoints: Uint8Array;
  keypointsFormat: string;
  poseModelName: string;
  poseModelVersion: string;
  fps: number;
  frameCount: number;
  durationSec: number;
  cameraView: string | null;
  deviceModel: string | null;
  appVersion: string | null;
};

export const ANALYSIS_ALREADY_STARTED_MESSAGE =
  "Analysis already started for this session";

export type SessionSnapshot = AnalysisSnapshot & {
  bullmqJobId: string | null;
};

type WorkerStage = Extract<
  AnalysisStage,
  "ANALYZING_REPS" | "WRITING_FEEDBACK"
>;

const SNAPSHOT_SELECT = {
  id: true,
  processingStatus: true,
  analysisStage: true,
  analysisStageProgress: true,
  failureReason: true,
  bullmqJobId: true,
} as const;

export const ONLY_FAILED_RETRYABLE_MESSAGE =
  "Only failed analyses can be retried";

const DAY_MS = 24 * 60 * 60 * 1000;

const dayAgo = (): Date => new Date(Date.now() - DAY_MS);

export class AnalysisStateService {
  private get prisma() {
    return getPrismaClient();
  }

  private runResetData(jobId: string) {
    return {
      processingStatus: SessionStatus.PROCESSING,
      analysisStage: "QUEUED" as const,
      analysisStageProgress: null,
      processingStartedAt: new Date(),
      processingFinishedAt: null,
      failureReason: null,
      bullmqJobId: jobId,
    };
  }

  private runGuard(sessionId: number, jobId: string) {
    return {
      id: sessionId,
      processingStatus: SessionStatus.PROCESSING,
      bullmqJobId: jobId,
    };
  }

  /**
   * Serializes one user's quota checks: READ COMMITTED gives each later
   * statement a fresh snapshot, so the count after the lock sees the other
   * transaction's committed insert.
   */
  private async lockUserQuota(
    tx: Prisma.TransactionClient,
    userId: number,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  }

  async findOwnedSession(
    userUuid: string,
    sessionId: number,
  ): Promise<SessionSnapshot & { userId: number }> {
    const userId = await getUserIdByUuid(this.prisma, userUuid);

    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: SNAPSHOT_SELECT,
    });

    if (!session) {
      throw new NotFoundError("Workout session not found");
    }

    return { ...session, userId };
  }

  async startRunWithCapture(
    sessionId: number,
    capture: CaptureInsert,
    jobId: string,
    userId: number,
  ): Promise<{ captureId: number }> {
    const captureId = await this.prisma.$transaction(async (tx) => {
      await this.lockUserQuota(tx, userId);

      const acceptedCount = await tx.poseCapture.count({
        where: { session: { userId }, createdAt: { gte: dayAgo() } },
      });
      if (acceptedCount >= env.formAnalysis.dailyCap) {
        throw new TooManyRequestsError(
          ANALYSIS_LIMIT_MESSAGES.dailyAnalysis,
          API_ERROR_CODES.DAILY_ANALYSIS_LIMIT_REACHED,
        );
      }

      const { count } = await tx.workoutSession.updateMany({
        where: { id: sessionId, processingStatus: SessionStatus.PENDING },
        data: this.runResetData(jobId),
      });

      if (count === 0) {
        throw new ConflictError(ANALYSIS_ALREADY_STARTED_MESSAGE);
      }

      try {
        const created = await tx.poseCapture.create({
          data: {
            sessionId,
            ...capture,
            keypoints: new Uint8Array(capture.keypoints),
          },
          select: { id: true },
        });
        return created.id;
      } catch (error) {
        if (
          isPrismaKnownRequestError(error) &&
          error.code === PrismaErrorCode.UNIQUE_CONSTRAINT_VIOLATION
        ) {
          throw new ConflictError(ANALYSIS_ALREADY_STARTED_MESSAGE);
        }
        throw error;
      }
    });

    await this.publishSnapshot(sessionId, logger);

    return { captureId };
  }

  async restartRun(
    sessionId: number,
    jobId: string,
    userId: number,
  ): Promise<{ captureId: number }> {
    const stored = await this.prisma.poseCapture.findFirst({
      where: { sessionId, keypoints: { not: null } },
      select: { id: true },
    });

    if (!stored) {
      throw new ConflictError("No stored capture to retry for this session");
    }

    await this.prisma.$transaction(async (tx) => {
      await this.lockUserQuota(tx, userId);

      const acceptedRetryCount = await tx.analysisRetry.count({
        where: { session: { userId }, createdAt: { gte: dayAgo() } },
      });
      if (acceptedRetryCount >= env.formAnalysis.dailyRetryCap) {
        throw new TooManyRequestsError(
          ANALYSIS_LIMIT_MESSAGES.dailyRetry,
          API_ERROR_CODES.DAILY_RETRY_LIMIT_REACHED,
        );
      }

      const { count } = await tx.workoutSession.updateMany({
        where: { id: sessionId, processingStatus: SessionStatus.FAILED },
        data: this.runResetData(jobId),
      });
      if (count === 0) {
        throw new ConflictError(ONLY_FAILED_RETRYABLE_MESSAGE);
      }

      // Last, so a refused retry rolls back without being recorded.
      await tx.analysisRetry.create({ data: { sessionId } });
    });

    await this.publishSnapshot(sessionId, logger);

    return { captureId: stored.id };
  }

  async advanceStage(
    sessionId: number,
    jobId: string,
    stage: WorkerStage,
    subProgress?: number,
    log: Logger = logger,
  ): Promise<boolean> {
    const current = await this.prisma.workoutSession.findFirst({
      where: this.runGuard(sessionId, jobId),
      select: { analysisStage: true, analysisStageProgress: true },
    });

    if (!current) return false;

    const currentPercent = progressPercent(
      current.analysisStage ?? "QUEUED",
      current.analysisStageProgress,
    );
    if (progressPercent(stage, subProgress) < currentPercent) return false;

    const { count } = await this.prisma.workoutSession.updateMany({
      where: this.runGuard(sessionId, jobId),
      data: {
        analysisStage: stage,
        analysisStageProgress: subProgress ?? null,
      },
    });

    if (count === 0) return false;

    await this.publishSnapshot(sessionId, log);
    return true;
  }

  /**
   * Completes the run and writes its result atomically; false (and no write)
   * when this job no longer owns a PROCESSING session. The guarded update runs
   * first so its row lock also serializes with failRun and the reaper.
   */
  async completeRunWithResult(
    sessionId: number,
    jobId: string,
    write: (tx: Prisma.TransactionClient) => Promise<void>,
    log: Logger = logger,
  ): Promise<boolean> {
    const isCompleted = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.workoutSession.updateMany({
        where: this.runGuard(sessionId, jobId),
        data: {
          processingStatus: SessionStatus.COMPLETED,
          analysisStage: "COMPLETED",
          analysisStageProgress: null,
          processingFinishedAt: new Date(),
          failureReason: null,
        },
      });
      if (count === 0) return false;

      await write(tx);
      return true;
    });

    if (isCompleted) await this.publishSnapshot(sessionId, log);
    return isCompleted;
  }

  async failRun(
    sessionId: number,
    jobId: string,
    reason: AnalysisFailureReason,
    log: Logger = logger,
  ): Promise<boolean> {
    const { count } = await this.prisma.workoutSession.updateMany({
      where: this.runGuard(sessionId, jobId),
      data: {
        processingStatus: SessionStatus.FAILED,
        processingFinishedAt: new Date(),
        failureReason: reason,
      },
    });

    if (count === 0) return false;

    await this.publishSnapshot(sessionId, log);
    return true;
  }

  async reapStuck(
    now: Date = new Date(),
    log: Logger = logger,
  ): Promise<number[]> {
    const cutoff = new Date(now.getTime() - env.analysis.stuckTimeoutMs);

    const stuck = await this.prisma.workoutSession.findMany({
      where: {
        processingStatus: SessionStatus.PROCESSING,
        processingStartedAt: { lt: cutoff },
      },
      select: { id: true },
    });

    if (stuck.length === 0) return [];

    const ids = stuck.map((s) => s.id);

    await this.prisma.workoutSession.updateMany({
      where: {
        id: { in: ids },
        processingStatus: SessionStatus.PROCESSING,
        processingStartedAt: { lt: cutoff },
      },
      data: {
        processingStatus: SessionStatus.FAILED,
        failureReason: "TIMEOUT",
        processingFinishedAt: now,
      },
    });

    const reaped: number[] = [];
    for (const id of ids) {
      const snapshot = await this.publishSnapshot(
        id,
        log,
        (s) => s.processingStatus === SessionStatus.FAILED,
      );
      if (
        snapshot?.processingStatus === SessionStatus.FAILED &&
        snapshot.failureReason === "TIMEOUT"
      ) {
        reaped.push(id);
      }
    }

    return reaped;
  }

  async getCaptureForJob(
    sessionId: number,
    captureId: number,
  ): Promise<{
    id: number;
    keypoints: Uint8Array | null;
    keypointsFormat: string;
  } | null> {
    return this.prisma.poseCapture.findFirst({
      where: { id: captureId, sessionId },
      select: { id: true, keypoints: true, keypointsFormat: true },
    });
  }

  async getAnalysisJobContext(sessionId: number): Promise<{
    userId: number;
    exerciseCode: string;
    exerciseDisplayName: string;
  } | null> {
    const session = await this.prisma.workoutSession.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        exercise: { select: { code: true, displayName: true } },
      },
    });

    if (!session) return null;

    return {
      userId: session.userId,
      exerciseCode: session.exercise.code,
      exerciseDisplayName: session.exercise.displayName,
    };
  }

  async getStatusEvent(sessionId: number): Promise<AnalysisStatusEvent | null> {
    const snapshot = await this.prisma.workoutSession.findUnique({
      where: { id: sessionId },
      select: SNAPSHOT_SELECT,
    });

    return snapshot ? toStatusEvent(snapshot) : null;
  }

  /**
   * Publishes the session's status event after a successful write. Never
   * throws and never awaits the publish: `IORedis` queues commands while Redis
   * is down, so awaiting would hang the caller. Queued publishes stay in order.
   */
  private async publishSnapshot(
    sessionId: number,
    log: Logger,
    shouldPublish: (snapshot: SessionSnapshot) => boolean = () => true,
  ): Promise<SessionSnapshot | null> {
    try {
      const snapshot = await this.prisma.workoutSession.findUnique({
        where: { id: sessionId },
        select: SNAPSHOT_SELECT,
      });
      if (!snapshot) return null;

      const event = shouldPublish(snapshot) ? toStatusEvent(snapshot) : null;
      if (event) {
        publishAnalysisEvent(event).catch((error: unknown) => {
          log.warn(
            { err: toError(error), sessionId },
            "Failed to publish analysis status event",
          );
        });
      }

      return snapshot;
    } catch (error) {
      log.warn(
        { err: toError(error), sessionId },
        "Failed to publish analysis status event",
      );
      return null;
    }
  }
}

export default new AnalysisStateService();
