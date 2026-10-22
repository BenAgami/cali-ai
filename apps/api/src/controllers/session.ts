import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import type { PoseCapturePayload } from "@repo/common";

import requireUserUuid from "../utils/requireUserUuid";
import captureService from "../services/captureService";

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
