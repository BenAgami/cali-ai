import type {
  CaptureAccepted,
  PoseCapturePayload,
  WorkoutSessionResponse,
} from "@repo/common";

import { apiClient } from "../client";
import { SESSION_ROUTES } from "@src/constants/routes";

export const sessionsApi = {
  create: (exerciseCode: string): Promise<WorkoutSessionResponse> =>
    apiClient.post<WorkoutSessionResponse>(SESSION_ROUTES.create, {
      exerciseCode,
    }),

  submitCapture: (
    sessionId: number,
    payload: PoseCapturePayload,
  ): Promise<CaptureAccepted> =>
    apiClient.postGzipJson<CaptureAccepted>(
      SESSION_ROUTES.capture(sessionId),
      payload,
    ),

  retryAnalysis: (sessionId: number): Promise<CaptureAccepted> =>
    apiClient.post<CaptureAccepted>(SESSION_ROUTES.retry(sessionId), {}),
};
