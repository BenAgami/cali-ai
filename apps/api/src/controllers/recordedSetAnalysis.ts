import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import type { PoseCapturePayload } from "@repo/common";

import requireUserUuid from "../utils/requireUserUuid";
import captureService from "../services/captureService";
import analysisResultQueryService from "../services/analysisResultQueryService";
import analysisStreamService from "../services/analysisStreamService";
import { openSseStream } from "../lib/sse";

/**
 * Accept an on-device pose capture and queue it for analysis
 * @route POST /api/recorded-sets/:id/capture
 */
export const submitCapture = async (req: Request, res: Response) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const data = await captureService.submitCapture(
    userUuid,
    Number(req.params.id),
    req.body as PoseCapturePayload,
  );

  res.status(StatusCodes.ACCEPTED).json({
    success: true,
    message: "Capture accepted for analysis",
    data,
  });
};

/**
 * Re-queue a FAILED analysis from its stored capture
 * @route POST /api/recorded-sets/:id/analysis/retry
 */
export const retryAnalysis = async (req: Request, res: Response) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const data = await captureService.retryAnalysis(
    userUuid,
    Number(req.params.id),
  );

  res.status(StatusCodes.ACCEPTED).json({
    success: true,
    message: "Analysis re-queued",
    data,
  });
};

/**
 * Get the analysis result for a completed recorded set (no raw score)
 * @route GET /api/recorded-sets/:id/analysis
 */
export const getRecordedSetAnalysis = async (req: Request, res: Response) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const data = await analysisResultQueryService.getRecordedSetAnalysis(
    userUuid,
    Number(req.params.id),
  );

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Analysis retrieved",
    data,
  });
};

/**
 * Stream analysis status events (SSE) for a recorded set
 * @route GET /api/recorded-sets/:id/status
 */
export const streamAnalysisStatus = async (req: Request, res: Response) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const recordedSetId = Number(req.params.id);

  await analysisStreamService.assertStreamable(userUuid, recordedSetId);

  const stream = openSseStream(req, res);
  await analysisStreamService.streamProgressToSink(recordedSetId, {
    send: (event) => stream.send("status", event),
    close: stream.close,
    onClose: stream.onClose,
  });
};
