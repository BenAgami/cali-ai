import { randomUUID } from "node:crypto";
import type { z } from "zod";

import {
  API_ERROR_CODES,
  type captureAcceptedResponseSchema,
  type PoseCapturePayload,
} from "@repo/common";
import { getPrismaClient, ProcessingStatus } from "@repo/db";

import { ConflictError, ServiceUnavailableError } from "../errors";
import { logger } from "../lib/logger";
import { ANALYSIS_JOB_NAME, formAnalysisQueue } from "../lib/queue";
import { encodeCapture, KEYPOINTS_FORMAT } from "../utils/captureCodec";
import { toStatusEvent } from "../utils/analysisProgress";
import { toError } from "../utils/toError";
import { withTimeout } from "../utils/withTimeout";

import aiPrerequisitesService from "./aiPrerequisitesService";
import analysisStateService, {
  ANALYSIS_ALREADY_STARTED_MESSAGE,
  ONLY_FAILED_RETRYABLE_MESSAGE,
  type RecordedSetSnapshot,
} from "./analysisStateService";

type CaptureAcceptedData = z.infer<typeof captureAcceptedResponseSchema>;

const ENQUEUE_TIMEOUT_MS = 5_000;

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
    recordedSetId: number,
    payload: PoseCapturePayload,
  ): Promise<CaptureAcceptedData> {
    const recordedSet = await analysisStateService.findOwnedRecordedSet(
      userUuid,
      recordedSetId,
    );

    if (recordedSet.processingStatus === ProcessingStatus.FAILED) {
      throw new ConflictError(
        "Analysis failed; retry the analysis",
        API_ERROR_CODES.ANALYSIS_FAILED,
      );
    }
    if (recordedSet.processingStatus !== ProcessingStatus.PENDING) {
      return this.acceptedRun(recordedSet);
    }

    await aiPrerequisitesService.assertAiPrerequisites(recordedSet.userId);

    const keypoints = await encodeCapture(payload);
    const jobId = newJobId();
    const { captureId } = await analysisStateService.startRunWithCapture(
      recordedSetId,
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
      recordedSet.userId,
    );

    await this.enqueue(recordedSetId, captureId, jobId);
    return { recordedSetId, captureId, jobId, status: "QUEUED" };
  }

  async retryAnalysis(
    userUuid: string,
    recordedSetId: number,
  ): Promise<CaptureAcceptedData> {
    const recordedSet = await analysisStateService.findOwnedRecordedSet(
      userUuid,
      recordedSetId,
    );
    if (recordedSet.processingStatus !== ProcessingStatus.FAILED) {
      throw new ConflictError(ONLY_FAILED_RETRYABLE_MESSAGE);
    }

    await aiPrerequisitesService.assertAiPrerequisites(recordedSet.userId);

    const jobId = newJobId();
    const { captureId } = await analysisStateService.restartRun(
      recordedSetId,
      jobId,
      recordedSet.userId,
    );

    await this.enqueue(recordedSetId, captureId, jobId);
    return { recordedSetId, captureId, jobId, status: "QUEUED" };
  }

  /**
   * A client whose capture response was lost resends the same capture; answer
   * with the run that capture started instead of refusing it, so the client
   * can follow that run. The resent body is not stored or counted again.
   */
  private async acceptedRun(
    recordedSet: RecordedSetSnapshot,
  ): Promise<CaptureAcceptedData> {
    const stored = await this.prisma.poseCapture.findUnique({
      where: { recordedSetId: recordedSet.id },
      select: { id: true },
    });
    const event = toStatusEvent(recordedSet);
    if (!stored || recordedSet.bullmqJobId === null || event === null) {
      throw new ConflictError(ANALYSIS_ALREADY_STARTED_MESSAGE);
    }
    return {
      recordedSetId: recordedSet.id,
      captureId: stored.id,
      jobId: recordedSet.bullmqJobId,
      status: event.status,
    };
  }

  /**
   * `IORedis` with `maxRetriesPerRequest: null` queues commands forever while
   * Redis is down, so the add is bounded; on failure the run is failed so the
   * recorded set never sits in PROCESSING with no job.
   */
  private async enqueue(
    recordedSetId: number,
    captureId: number,
    jobId: string,
  ): Promise<void> {
    try {
      await withTimeout(
        formAnalysisQueue.add(
          ANALYSIS_JOB_NAME,
          { recordedSetId, captureId },
          { jobId },
        ),
        ENQUEUE_TIMEOUT_MS,
        "ENQUEUE_TIMEOUT",
      );
    } catch (error) {
      logger.error(
        { err: toError(error), recordedSetId, jobId },
        "Failed to enqueue analysis job",
      );
      await analysisStateService.failRun(
        recordedSetId,
        jobId,
        "ENQUEUE_FAILED",
      );
      throw new ServiceUnavailableError(
        "Analysis queue is unavailable, please retry shortly",
      );
    }
  }
}

export default new CaptureService();
