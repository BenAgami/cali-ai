import express, { Router } from "express";
import z from "zod";

import { CAPTURE_LIMITS, poseCapturePayloadSchema } from "@repo/common";

import validateSchema from "../middlewares/validateSchema";
import rejectOversizedBody from "../middlewares/rejectOversizedBody";
import gunzipCaptureBody from "../middlewares/gunzipCaptureBody";
import { authenticateToken } from "../middlewares/auth";

import {
  getRecordedSetAnalysis,
  retryAnalysis,
  streamAnalysisStatus,
  submitCapture,
} from "../controllers/recordedSetAnalysis";

const router: Router = Router();

const recordedSetIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * POST /:id/capture
 * Submit pose keypoints for a recorded set; returns 202 + job id.
 * Sent only as a gzip file (`Content-Type: application/gzip`).
 */
router.post(
  "/:id/capture",
  authenticateToken,
  rejectOversizedBody(CAPTURE_LIMITS.maxCompressedBytes),
  express.raw({
    type: "application/gzip",
    limit: CAPTURE_LIMITS.maxCompressedBytes,
  }),
  gunzipCaptureBody(CAPTURE_LIMITS.maxInflatedBytes),
  validateSchema(
    z.object({
      params: recordedSetIdParamsSchema,
      body: poseCapturePayloadSchema,
    }),
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
  validateSchema(z.object({ params: recordedSetIdParamsSchema })),
  retryAnalysis,
);

/**
 * GET /:id/analysis
 * Completed analysis result (band, dimensions, feedback) or untrackable advice
 */
router.get(
  "/:id/analysis",
  authenticateToken,
  validateSchema(z.object({ params: recordedSetIdParamsSchema })),
  getRecordedSetAnalysis,
);

/**
 * GET /:id/status
 * Server-Sent Events stream of analysis progress for a recorded set
 */
router.get(
  "/:id/status",
  authenticateToken,
  validateSchema(z.object({ params: recordedSetIdParamsSchema })),
  streamAnalysisStatus,
);

export default router;
