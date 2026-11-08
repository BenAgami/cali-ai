import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";

import { registry } from "./registry";

import "./paths/health";
import "./paths/auth";
import "./paths/users";
import "./paths/workouts";
import "./paths/exercises";
import "./paths/workoutSessions";
import "./paths/sessions";

registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

export const spec = new OpenApiGeneratorV31(
  registry.definitions,
).generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Cali AI API",
    version: "1.0.0",
    description:
      "REST API for Cali AI — AI-powered calisthenics form feedback.\n\nAuthenticate via the `/auth/login` endpoint to obtain a Bearer token, then include it as `Authorization: Bearer <token>` on all protected routes.",
  },
  servers: [{ url: "/api" }],
});
