import type {
  CaptureAccepted,
  CreateWorkoutSessionValues,
  FormAnalysisResponse,
  PoseCapturePayload,
  SESSION_STATUSES,
  WorkoutSessionListResponse,
  WorkoutSessionResponse,
} from "@repo/common";

import { apiClient } from "../client";
import { SESSION_ROUTES } from "@src/constants/routes";

type SessionStatusValue = (typeof SESSION_STATUSES)[number];

const DEFAULT_LIST_LIMIT = 20;

export const sessionsApi = {
  create: (
    input: CreateWorkoutSessionValues,
  ): Promise<WorkoutSessionResponse> =>
    apiClient.post<WorkoutSessionResponse>(SESSION_ROUTES.create, input),

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

  getAnalysis: (sessionId: number): Promise<FormAnalysisResponse> =>
    apiClient.get<FormAnalysisResponse>(SESSION_ROUTES.analysis(sessionId)),

  listByStatus: (
    processingStatus: SessionStatusValue,
    limit = DEFAULT_LIST_LIMIT,
  ): Promise<WorkoutSessionListResponse> =>
    apiClient.get<WorkoutSessionListResponse>(
      `${SESSION_ROUTES.list}?processingStatus=${processingStatus}&limit=${limit}`,
    ),
};
