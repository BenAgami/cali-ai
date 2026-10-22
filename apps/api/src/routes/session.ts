import { Router } from "express";
import z from "zod";

import { CAPTURE_LIMITS, poseCapturePayloadSchema } from "@repo/common";

import validateSchema from "../middlewares/validateSchema";
import rejectOversizedBody from "../middlewares/rejectOversizedBody";
import { authenticateToken } from "../middlewares/auth";

import { retryAnalysis, submitCapture } from "../controllers/session";

const router: Router = Router();

const sessionIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * POST /:id/capture
 * Submit gzipped pose keypoints for a session; returns 202 + job id
 */
router.post(
  "/:id/capture",
  rejectOversizedBody(CAPTURE_LIMITS.maxCompressedBytes),
  authenticateToken,
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

export default router;
