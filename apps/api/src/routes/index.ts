import { Router } from "express";

import { env } from "../config/env";

import healthRoutes from "./health";
import authRoutes from "./auth";
import userRoutes from "./user";
import workoutSessionRoutes from "./workoutSession";
import sessionRoutes from "./session";
import exerciseRoutes from "./exercise";
import workoutRoutes from "./workout";
import openapiRoutes from "./openapi";

const registerPublicRoutes = (router: Router): void => {
  router.use("/auth", authRoutes);
  router.use("/users", userRoutes);
  router.use("/exercises", exerciseRoutes);
  router.use("/workouts", workoutRoutes);
  router.use("/workout-sessions", workoutSessionRoutes);
  router.use("/sessions", sessionRoutes);
};

const registerInternalRoutes = (router: Router): void => {
  router.use("/health", healthRoutes);

  if (env.runtimeEnv !== "production") {
    router.use("/", openapiRoutes);
  }
};

const router: Router = Router();

registerPublicRoutes(router);
registerInternalRoutes(router);

export default router;
