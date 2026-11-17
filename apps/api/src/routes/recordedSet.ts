import { Router } from "express";
import z from "zod";

import { createRecordedSetSchema, PROCESSING_STATUSES } from "@repo/common";

import validateSchema from "../middlewares/validateSchema";
import { authenticateToken } from "../middlewares/auth";

import {
  createRecordedSet,
  listRecordedSets,
} from "../controllers/recordedSet";

const router: Router = Router();

const listRecordedSetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  exerciseCode: z.string().trim().min(1).max(40).optional(),
  processingStatus: z.enum(PROCESSING_STATUSES).optional(),
});

/**
 * POST /
 * Create recorded set
 */
router.post(
  "/",
  authenticateToken,
  validateSchema(z.object({ body: createRecordedSetSchema })),
  createRecordedSet,
);

/**
 * GET /
 * List recorded sets for current user
 */
router.get(
  "/",
  authenticateToken,
  validateSchema(z.object({ query: listRecordedSetsQuerySchema })),
  listRecordedSets,
);

export default router;
