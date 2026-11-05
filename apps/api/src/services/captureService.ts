import { randomUUID } from "node:crypto";
import type { z } from "zod";

import type {
  captureAcceptedResponseSchema,
  PoseCapturePayload,
} from "@repo/common";
import { SessionStatus } from "@repo/db";

import { ConflictError, ServiceUnavailableError } from "../errors";
import { logger } from "../lib/logger";
import { ANALYSIS_JOB_NAME, formAnalysisQueue } from "../lib/queue";
import { encodeCapture, KEYPOINTS_FORMAT } from "../utils/captureCodec";
import { toError } from "../utils/toError";
import { withTimeout } from "../utils/withTimeout";

import analysisStateService from "./analysisStateService";

type CaptureAcceptedData = z.infer<typeof captureAcceptedResponseSchema>;

const ENQUEUE_TIMEOUT_MS = 5_000;

const newJobId = (): string => `analysis-${randomUUID()}`;

/**
 * Accepts a pose capture and queues it for analysis. Nothing heavy happens
 * here: the worker decodes the keypoints, computes metrics and calls the LLM.
 */
export class CaptureService {
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

    const jobId = newJobId();
    const { captureId } = await analysisStateService.restartRun(
      sessionId,
      jobId,
    );

    await this.enqueue(sessionId, captureId, jobId);
    return { sessionId, captureId, jobId, status: "QUEUED" };
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
