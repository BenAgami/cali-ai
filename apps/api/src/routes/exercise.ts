import { Router } from "express";
import z from "zod";

import validateSchema from "../middlewares/validateSchema";
import optionalAuth from "../middlewares/optionalAuth";
import { getExerciseByCode, listExercises } from "../controllers/exercise";

const router: Router = Router();

const listExercisesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  includeInactive: z.coerce.boolean().optional(),
});

const exerciseCodeParamSchema = z.object({
  code: z.string().trim().min(1).max(40),
});

/**
 * GET /
 * List exercises (optionally filtered by active status; includeInactive requires admin)
 */
router.get(
  "/",
  optionalAuth,
  validateSchema(z.object({ query: listExercisesQuerySchema })),
  listExercises,
);

/**
 * GET /:code
 * Get exercise by code
 */
router.get(
  "/:code",
  validateSchema(z.object({ params: exerciseCodeParamSchema })),
  getExerciseByCode,
);

export default router;
