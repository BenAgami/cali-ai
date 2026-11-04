import { z } from "zod";

import { registry } from "../registry";
import {
  CreateWorkoutBody,
  GenerateWorkoutBody,
  WorkoutGenerationPreviewResponse,
  UpdateWorkoutBody,
  WorkoutLogBody,
  WorkoutResponse,
  WorkoutLogResponse,
  paginatedData,
  successResponse,
  errorResponse,
} from "../schemas";

const bearerAuth = { BearerAuth: [] };

const workoutIdParam = z.object({
  id: z.number().int().openapi({ example: 1 }),
});

const paginationQuery = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .openapi({ description: "Max items to return (1-100)", example: 20 }),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .openapi({ description: "Number of items to skip", example: 0 }),
});

registry.registerPath({
  method: "get",
  path: "/workouts",
  tags: ["Workouts"],
  summary: "List workouts for the current user",
  security: [bearerAuth],
  request: { query: paginationQuery },
  responses: {
    200: successResponse(
      paginatedData(WorkoutResponse),
      "Paginated workout list",
    ),
    400: errorResponse("Invalid query parameters"),
    401: errorResponse("Unauthorized"),
    500: errorResponse("Internal server error"),
  },
});

registry.registerPath({
  method: "post",
  path: "/workouts",
  tags: ["Workouts"],
  summary: "Create a new workout",
  security: [bearerAuth],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CreateWorkoutBody } },
    },
  },
  responses: {
    201: successResponse(WorkoutResponse, "Workout created"),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    404: errorResponse(
      "Referenced exercise not found, or generationId does not belong to the user / did not succeed",
    ),
    409: errorResponse("generationId already saved (GENERATION_ALREADY_SAVED)"),
    500: errorResponse("Internal server error"),
  },
});

registry.registerPath({
  method: "post",
  path: "/workouts/generate",
  tags: ["Workouts"],
  summary: "Generate a workout preview with AI (not saved)",
  description:
    "Synchronous. Save the preview via POST /workouts with its generationId.",
  security: [bearerAuth],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: GenerateWorkoutBody } },
    },
  },
  responses: {
    200: successResponse(
      WorkoutGenerationPreviewResponse,
      "Generated workout preview",
    ),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    409: errorResponse("Generation already running (GENERATION_IN_PROGRESS)"),
    428: errorResponse(
      "Prerequisite missing (PROFILE_INCOMPLETE | BODY_METRICS_REQUIRED | AI_CONSENT_REQUIRED)",
    ),
    429: errorResponse("Daily generation cap reached (DAILY_LIMIT_REACHED)"),
    503: errorResponse(
      "Generation unavailable (GENERATION_FAILED | LLM_RATE_LIMITED | LLM_UNAVAILABLE | CATALOG_EMPTY)",
    ),
    500: errorResponse("Internal server error"),
  },
});

registry.registerPath({
  method: "get",
  path: "/workouts/{id}",
  tags: ["Workouts"],
  summary: "Get a workout by ID",
  security: [bearerAuth],
  request: { params: workoutIdParam },
  responses: {
    200: successResponse(WorkoutResponse, "Workout"),
    400: errorResponse("Invalid workout ID"),
    401: errorResponse("Unauthorized"),
    404: errorResponse("Workout not found"),
    500: errorResponse("Internal server error"),
  },
});

registry.registerPath({
  method: "patch",
  path: "/workouts/{id}",
  tags: ["Workouts"],
  summary: "Update a workout",
  security: [bearerAuth],
  request: {
    params: workoutIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: UpdateWorkoutBody } },
    },
  },
  responses: {
    200: successResponse(WorkoutResponse, "Updated workout"),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    404: errorResponse("Workout or referenced exercise not found"),
    500: errorResponse("Internal server error"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/workouts/{id}",
  tags: ["Workouts"],
  summary: "Delete a workout",
  security: [bearerAuth],
  request: { params: workoutIdParam },
  responses: {
    204: { description: "Workout deleted" },
    400: errorResponse("Invalid workout ID"),
    401: errorResponse("Unauthorized"),
    404: errorResponse("Workout not found"),
    500: errorResponse("Internal server error"),
  },
});

registry.registerPath({
  method: "post",
  path: "/workouts/{id}/logs",
  tags: ["Workouts"],
  summary: "Log a completed workout",
  security: [bearerAuth],
  request: {
    params: workoutIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: WorkoutLogBody } },
    },
  },
  responses: {
    201: successResponse(WorkoutLogResponse, "Workout log created"),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    404: errorResponse("Workout not found"),
    500: errorResponse("Internal server error"),
  },
});
