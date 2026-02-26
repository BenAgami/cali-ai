import { Router } from "express";
import z from "zod";

import { loginSchema, registerSchema } from "@repo/common";

import validateSchema from "../middlewares/validateSchema";
import authenticateToken from "../middlewares/auth";

import {
  registerUser,
  loginUser,
  getUserProfile,
  getMyUser,
} from "../controllers/user";

const router: Router = Router();

/**
 * POST /register
 * Register a new user
 */
router.post(
  "/register",
  validateSchema(z.object({ body: registerSchema })),
  registerUser,
);

/**
 * POST /login
 * Login a user
 */
router.post(
  "/login",
  validateSchema(z.object({ body: loginSchema })),
  loginUser,
);

/**
 * GET /:uuid
 * Get user profile by UUID
 */
router.get(
  "/:uuid",
  validateSchema(z.object({ params: z.object({ uuid: z.uuidv7() }) })),
  getUserProfile,
);

/**
 * GET /me
 * Get current authenticated user's profile
 */
router.get("/me", authenticateToken, getMyUser);

export default router;
