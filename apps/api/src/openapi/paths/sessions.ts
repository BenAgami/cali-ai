import { z } from "zod";

import { registry } from "../registry";
import {
  CaptureAccepted,
  PoseCaptureBody,
  successResponse,
  errorResponse,
} from "../schemas";

const bearerAuth = { BearerAuth: [] };

const sessionIdParams = z.object({
  id: z.number().int().positive().openapi({ description: "Session id" }),
});

registry.registerPath({
  method: "post",
  path: "/sessions/{id}/capture",
  tags: ["Session Analysis"],
  summary: "Submit on-device pose keypoints for analysis",
  security: [bearerAuth],
  request: {
    params: sessionIdParams,
    body: {
      required: true,
      description:
        "Pose keypoints for one set. May be sent with `Content-Encoding: gzip`; the compressed size cap is 1 MiB.",
      content: { "application/json": { schema: PoseCaptureBody } },
    },
  },
  responses: {
    202: successResponse(CaptureAccepted, "Capture accepted and queued"),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    404: errorResponse("Session not found"),
    409: errorResponse("Session is not PENDING"),
    413: errorResponse("Compressed body exceeds 1 MiB"),
    503: errorResponse("Queue unavailable"),
    500: errorResponse("Internal server error"),
  },
});

registry.registerPath({
  method: "post",
  path: "/sessions/{id}/analysis/retry",
  tags: ["Session Analysis"],
  summary: "Retry a failed analysis from its stored capture",
  security: [bearerAuth],
  request: { params: sessionIdParams },
  responses: {
    202: successResponse(CaptureAccepted, "Analysis re-queued"),
    401: errorResponse("Unauthorized"),
    404: errorResponse("Session not found"),
    409: errorResponse("Session is not FAILED or has no stored capture"),
    503: errorResponse("Queue unavailable"),
    500: errorResponse("Internal server error"),
  },
});
