import { Router } from "express";
import z from "zod";

import {
  createWorkoutPlanSchema,
  generateWorkoutSchema,
  recordedSetsQuerySchema,
  updateWorkoutPlanSchema,
  workoutPlanIdParamSchema,
  workoutRunIdParamSchema,
} from "@repo/common";

import validateSchema from "../middlewares/validateSchema";
import { authenticateToken } from "../middlewares/auth";

import {
  listWorkoutPlans,
  getWorkoutPlanById,
  createWorkoutPlan,
  generateWorkout,
  updateWorkoutPlan,
  deleteWorkoutPlan,
  startWorkout,
  completeWorkout,
  listRecordedSets,
} from "../controllers/workoutPlan";

const router: Router = Router();

const listWorkoutPlansQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * GET /
 * List workouts for current user
 */
router.get(
  "/",
  authenticateToken,
  validateSchema(z.object({ query: listWorkoutPlansQuerySchema })),
  listWorkoutPlans,
);

/**
 * POST /
 * Create workout
 */
router.post(
  "/",
  authenticateToken,
  validateSchema(z.object({ body: createWorkoutPlanSchema })),
  createWorkoutPlan,
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
  validateSchema(z.object({ params: workoutPlanIdParamSchema })),
  getWorkoutPlanById,
);

/**
 * PATCH /:id
 * Update workout
 */
router.patch(
  "/:id",
  authenticateToken,
  validateSchema(
    z.object({
      params: workoutPlanIdParamSchema,
      body: updateWorkoutPlanSchema,
    }),
  ),
  updateWorkoutPlan,
);

/**
 * DELETE /:id
 * Delete workout
 */
router.delete(
  "/:id",
  authenticateToken,
  validateSchema(z.object({ params: workoutPlanIdParamSchema })),
  deleteWorkoutPlan,
);

/**
 * POST /:id/runs
 * Start a workout run (create an in-progress run)
 */
router.post(
  "/:id/runs",
  authenticateToken,
  validateSchema(z.object({ params: workoutPlanIdParamSchema })),
  startWorkout,
);

/**
 * PATCH /:id/runs/:runId
 * Complete a workout run
 */
router.patch(
  "/:id/runs/:runId",
  authenticateToken,
  validateSchema(z.object({ params: workoutRunIdParamSchema })),
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
      params: workoutPlanIdParamSchema,
      query: recordedSetsQuerySchema,
    }),
  ),
  listRecordedSets,
);

export default router;
