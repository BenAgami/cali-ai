import express, { Router } from "express";
import z from "zod";

import { CAPTURE_LIMITS, poseCapturePayloadSchema } from "@repo/common";

import validateSchema from "../middlewares/validateSchema";
import rejectOversizedBody from "../middlewares/rejectOversizedBody";
import gunzipCaptureBody from "../middlewares/gunzipCaptureBody";
import { authenticateToken } from "../middlewares/auth";

import {
  retryAnalysis,
  streamAnalysisStatus,
  submitCapture,
} from "../controllers/session";

const router: Router = Router();

const sessionIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * POST /:id/capture
 * Submit pose keypoints for a session; returns 202 + job id.
 * Sent as a gzip file (`Content-Type: application/gzip`); plain JSON also works.
 */
router.post(
  "/:id/capture",
  rejectOversizedBody(CAPTURE_LIMITS.maxCompressedBytes),
  authenticateToken,
  express.raw({
    type: "application/gzip",
    limit: CAPTURE_LIMITS.maxCompressedBytes,
  }),
  gunzipCaptureBody(CAPTURE_LIMITS.maxInflatedBytes),
  validateSchema(
    z.object({ params: sessionIdParamsSchema, body: poseCapturePayloadSchema }),
  ),
  submitCapture,
);

/**
 * POST /:id/analysis/retry
 * Re-queue a FAILED analysis from its stored capture
 */
router.post(
  "/:id/analysis/retry",
  authenticateToken,
  validateSchema(z.object({ params: sessionIdParamsSchema })),
  retryAnalysis,
);

/**
 * GET /:id/status
 * Server-Sent Events stream of analysis progress for a session
 */
router.get(
  "/:id/status",
  authenticateToken,
  validateSchema(z.object({ params: sessionIdParamsSchema })),
  streamAnalysisStatus,
);

export default router;
