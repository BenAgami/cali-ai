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
 * @route POST /api/sessions/:id/capture
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
 * @route POST /api/sessions/:id/analysis/retry
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
 * Get the analysis result for a completed session (no raw score)
 * @route GET /api/sessions/:id/analysis
 */
export const getSessionAnalysis = async (req: Request, res: Response) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const data = await analysisResultQueryService.getSessionAnalysis(
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
 * Stream analysis status events (SSE) for a session
 * @route GET /api/sessions/:id/status
 */
export const streamAnalysisStatus = async (req: Request, res: Response) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const sessionId = Number(req.params.id);

  await analysisStreamService.assertStreamable(userUuid, sessionId);

  const stream = openSseStream(req, res);
  await analysisStreamService.streamProgressToSink(sessionId, {
    send: (event) => stream.send("status", event),
    close: stream.close,
    onClose: stream.onClose,
  });
};
