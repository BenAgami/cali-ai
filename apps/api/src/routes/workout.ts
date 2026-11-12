import { Router } from "express";
import z from "zod";

import {
  completeWorkoutLogSchema,
  createWorkoutSchema,
  generateWorkoutSchema,
  updateWorkoutSchema,
} from "@repo/common";

import validateSchema from "../middlewares/validateSchema";
import { authenticateToken } from "../middlewares/auth";

import {
  listWorkouts,
  getWorkoutById,
  createWorkout,
  generateWorkout,
  updateWorkout,
  deleteWorkout,
  startWorkout,
  completeWorkout,
  listRecordedSets,
} from "../controllers/workout";

const router: Router = Router();

const listWorkoutsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const recordedSetsQuerySchema = z.object({
  workoutLogId: z.coerce.number().int().positive().optional(),
});

const workoutIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const workoutLogIdParamSchema = workoutIdParamSchema.extend({
  logId: z.coerce.number().int().positive(),
});

/**
 * GET /
 * List workouts for current user
 */
router.get(
  "/",
  authenticateToken,
  validateSchema(z.object({ query: listWorkoutsQuerySchema })),
  listWorkouts,
);

/**
 * POST /
 * Create workout
 */
router.post(
  "/",
  authenticateToken,
  validateSchema(z.object({ body: createWorkoutSchema })),
  createWorkout,
);

/**
 * POST /generate
 * Generate an AI workout preview (registered before /:id routes)
 */
router.post(
  "/generate",
  authenticateToken,
  validateSchema(z.object({ body: generateWorkoutSchema })),
  generateWorkout,
);

/**
 * GET /:id
 * Get workout by id
 */
router.get(
  "/:id",
  authenticateToken,
  validateSchema(z.object({ params: workoutIdParamSchema })),
  getWorkoutById,
);

/**
 * PATCH /:id
 * Update workout
 */
router.patch(
  "/:id",
  authenticateToken,
  validateSchema(
    z.object({ params: workoutIdParamSchema, body: updateWorkoutSchema }),
  ),
  updateWorkout,
);

/**
 * DELETE /:id
 * Delete workout
 */
router.delete(
  "/:id",
  authenticateToken,
  validateSchema(z.object({ params: workoutIdParamSchema })),
  deleteWorkout,
);

/**
 * POST /:id/logs
 * Start a workout run (create an in-progress log)
 */
router.post(
  "/:id/logs",
  authenticateToken,
  validateSchema(z.object({ params: workoutIdParamSchema })),
  startWorkout,
);

/**
 * PATCH /:id/logs/:logId
 * Complete a workout run
 */
router.patch(
  "/:id/logs/:logId",
  authenticateToken,
  validateSchema(
    z.object({
      params: workoutLogIdParamSchema,
      body: completeWorkoutLogSchema,
    }),
  ),
  completeWorkout,
);

/**
 * GET /:id/recorded-sets
 * List the recorded sets of a workout with live analysis status
 */
router.get(
  "/:id/recorded-sets",
  authenticateToken,
  validateSchema(
    z.object({
      params: workoutIdParamSchema,
      query: recordedSetsQuerySchema,
    }),
  ),
  listRecordedSets,
);

export default router;
