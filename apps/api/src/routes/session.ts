import { Router } from "express";
import z from "zod";

import { createWorkoutSessionSchema } from "@repo/common";

import validateSchema from "../middlewares/validateSchema";
import authenticateToken from "../middlewares/authentication";
import {
  createWorkoutSession,
  listWorkoutSessions,
} from "../controllers/workoutSession";

const router: Router = Router();

const listWorkoutSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  exerciseCode: z.string().trim().min(1).max(40).optional(),
});

/**
 * POST /
 * Create workout session
 */
router.post(
  "/",
  authenticateToken,
  validateSchema(z.object({ body: createWorkoutSessionSchema })),
  createWorkoutSession,
);

/**
 * GET /
 * List workout sessions for current user
 */
router.get(
  "/",
  authenticateToken,
  validateSchema(z.object({ query: listWorkoutSessionsQuerySchema })),
  listWorkoutSessions,
);

export default router;
