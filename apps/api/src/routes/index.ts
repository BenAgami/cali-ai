import { Router } from "express";

import { env } from "../config/env";

import healthRoutes from "./health";
import authRoutes from "./auth";
import userRoutes from "./user";
import recordedSetRoutes from "./recordedSet";
import recordedSetAnalysisRoutes from "./recordedSetAnalysis";
import exerciseRoutes from "./exercise";
import workoutPlanRoutes from "./workoutPlan";
import openapiRoutes from "./openapi";

const registerPublicRoutes = (router: Router): void => {
  router.use("/auth", authRoutes);
  router.use("/users", userRoutes);
  router.use("/exercises", exerciseRoutes);
  router.use("/workout-plans", workoutPlanRoutes);
  router.use("/recorded-sets", recordedSetRoutes);
  router.use("/recorded-sets", recordedSetAnalysisRoutes);
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
