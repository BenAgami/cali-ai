import { useQuery } from "@tanstack/react-query";
import type { FormAnalysisResponse } from "@repo/common";

import { ApiError, analysisKeys, sessionsApi } from "@src/api";

const MAX_RETRIES = 2;
const CONFLICT_STATUS = 409;

export const useSessionAnalysis = (sessionId: number | undefined) =>
  useQuery<FormAnalysisResponse, Error>({
    queryKey: analysisKeys.session(sessionId!),
    queryFn: () => sessionsApi.getAnalysis(sessionId!),
    enabled: sessionId !== undefined,
    staleTime: Infinity,
    // 409 means the analysis is not COMPLETED yet; retrying will not help.
    retry: (count, error) =>
      !(error instanceof ApiError && error.status === CONFLICT_STATUS) &&
      count < MAX_RETRIES,
  });
