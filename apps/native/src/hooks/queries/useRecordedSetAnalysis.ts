import { useQuery } from "@tanstack/react-query";
import { StatusCodes } from "http-status-codes";
import type { FormAnalysisResponse } from "@repo/common";

import { ApiError, analysisKeys, recordedSetsApi } from "@src/api";

const MAX_RETRIES = 2;

export const useRecordedSetAnalysis = (recordedSetId: number | undefined) =>
  useQuery<FormAnalysisResponse, Error>({
    queryKey: analysisKeys.recordedSet(recordedSetId!),
    queryFn: () => recordedSetsApi.getAnalysis(recordedSetId!),
    enabled: recordedSetId !== undefined,
    staleTime: Infinity,
    // 409 means the analysis is not COMPLETED yet; retrying will not help.
    retry: (count, error) =>
      !(
        error instanceof ApiError &&
        error.status === Number(StatusCodes.CONFLICT)
      ) && count < MAX_RETRIES,
  });
