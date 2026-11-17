import { z } from "zod";

import { PROCESSING_STATUSES } from "@repo/common";

import { registry } from "../registry";
import {
  CreateRecordedSetBody,
  RecordedSetResponse,
  RecordedSetListItem,
  paginatedData,
  successResponse,
  errorResponse,
} from "../schemas";

const bearerAuth = { BearerAuth: [] };

registry.registerPath({
  method: "post",
  path: "/recorded-sets",
  tags: ["Recorded Sets"],
  summary: "Create a recorded set",
  security: [bearerAuth],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CreateRecordedSetBody } },
    },
  },
  responses: {
    201: successResponse(RecordedSetResponse, "Recorded set created"),
    400: errorResponse("Validation error or unsupported exercise"),
    401: errorResponse("Unauthorized"),
    404: errorResponse("Exercise, workout or workout run not found"),
    409: errorResponse("Workout run is already completed"),
    428: errorResponse(
      "AI prerequisites missing (PROFILE_INCOMPLETE, BODY_METRICS_REQUIRED or AI_CONSENT_REQUIRED)",
    ),
    500: errorResponse("Internal server error"),
  },
});

registry.registerPath({
  method: "get",
  path: "/recorded-sets",
  tags: ["Recorded Sets"],
  summary: "List recorded sets for the current user",
  security: [bearerAuth],
  request: {
    query: z.object({
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
      exerciseCode: z.string().optional().openapi({
        description: "Filter by exercise code",
        example: "push_up",
      }),
      processingStatus: z.enum(PROCESSING_STATUSES).optional().openapi({
        description: "Filter by processing status",
        example: "PROCESSING",
      }),
    }),
  },
  responses: {
    200: successResponse(
      paginatedData(RecordedSetListItem),
      "Paginated recorded set list",
    ),
    400: errorResponse("Invalid query parameters"),
    401: errorResponse("Unauthorized"),
    500: errorResponse("Internal server error"),
  },
});
