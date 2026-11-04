import { Router } from "express";
import z from "zod";

import {
  aiConsentSchema,
  bodyMetricInputSchema,
  updateProfileSchema,
  upsertGoalSchema,
} from "@repo/common";

import validateSchema from "../middlewares/validateSchema";
import { authenticateToken } from "../middlewares/auth";

import {
  getUserProfile,
  getMyUser,
  updateMyProfile,
  getAvatarUploadUrl,
  createMyGoal,
  saveMyBodyMetrics,
  recordMyAiConsent,
} from "../controllers/user";

const router: Router = Router();

/**
 * GET /me
 * Get current authenticated user's profile
 */
router.get("/me", authenticateToken, getMyUser);

/**
 * PATCH /me
 * Update current authenticated user's profile
 */
router.patch(
  "/me",
  authenticateToken,
  validateSchema(z.object({ body: updateProfileSchema })),
  updateMyProfile,
);

/**
 * POST /me/avatar-upload-url
 * Get presigned URL for avatar upload
 */
router.post("/me/avatar-upload-url", authenticateToken, getAvatarUploadUrl);

/**
 * POST /me/goals
 * Create a goal for the current authenticated user
 */
router.post(
  "/me/goals",
  authenticateToken,
  validateSchema(z.object({ body: upsertGoalSchema })),
  createMyGoal,
);

/**
 * POST /me/body-metrics
 * Save height and weight (new row only when changed)
 */
router.post(
  "/me/body-metrics",
  authenticateToken,
  validateSchema(z.object({ body: bodyMetricInputSchema })),
  saveMyBodyMetrics,
);

/**
 * POST /me/ai-consent
 * Record acceptance of the AI privacy notice
 */
router.post(
  "/me/ai-consent",
  authenticateToken,
  validateSchema(z.object({ body: aiConsentSchema })),
  recordMyAiConsent,
);

/**
 * GET /:uuid
 * Get user profile by UUID (requires authentication)
 */
router.get(
  "/:uuid",
  authenticateToken,
  validateSchema(z.object({ params: z.object({ uuid: z.uuidv7() }) })),
  getUserProfile,
);

export default router;
