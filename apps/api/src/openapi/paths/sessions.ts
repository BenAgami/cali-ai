import { z } from "zod";

import { registry } from "../registry";
import { CaptureAccepted, successResponse, errorResponse } from "../schemas";

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
        "Pose keypoints for one set. Send the JSON body gzip-compressed with `Content-Type: application/gzip` (the compressed size cap is 1 MiB, the decompressed cap 10 MiB).",
      content: {
        "application/gzip": {
          schema: z.string().openapi({
            format: "binary",
            description: "Gzip-compressed JSON matching PoseCaptureBody.",
          }),
        },
      },
    },
  },
  responses: {
    202: successResponse(CaptureAccepted, "Capture accepted and queued"),
    400: errorResponse(
      "Validation error, or the body is not gzip (any other content type is rejected)",
    ),
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

registry.registerPath({
  method: "get",
  path: "/sessions/{id}/status",
  tags: ["Session Analysis"],
  summary: "Stream analysis progress (Server-Sent Events)",
  description:
    "The current state is sent first, then live transitions. Each `event: status` message carries JSON matching the AnalysisStatusEvent schema.",
  security: [bearerAuth],
  request: { params: sessionIdParams },
  responses: {
    200: {
      description: "Event stream",
      content: {
        "text/event-stream": {
          schema: z.string().openapi({
            description:
              "Stream of `event: status` messages; each `data:` line is JSON matching AnalysisStatusEvent. The stream closes after a COMPLETED or FAILED event. Heartbeat comments every 15 s.",
          }),
        },
      },
    },
    401: errorResponse("Unauthorized"),
    404: errorResponse("Session not found"),
    409: errorResponse("No analysis started"),
    500: errorResponse("Internal server error"),
  },
});
