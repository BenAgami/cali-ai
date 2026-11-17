import { useCallback, useEffect } from "react";
import { router } from "expo-router";
import { StatusCodes } from "http-status-codes";
import type { AnalysisStatusEvent, FormAnalysisResponse } from "@repo/common";

import { ApiError } from "@src/api";
import { useAnalysisTracker } from "@src/context/AnalysisTrackerContext";
import { useSessionAnalysis } from "@src/hooks/queries/useSessionAnalysis";
import { parsePositiveIntParam } from "@src/utils/parsePositiveIntParam";

export type AnalysisResultState =
  | "loading"
  | "notReady"
  | "error"
  | "scored"
  | "untrackable";

interface AnalysisResultScreen {
  state: AnalysisResultState;
  analysis: FormAnalysisResponse | undefined;
  liveEvent: AnalysisStatusEvent | undefined;
  refetch: () => void;
  recordAgain: (() => void) | undefined;
}

export const useAnalysisResultScreen = (
  sessionIdParam: string | undefined,
): AnalysisResultScreen => {
  const sessionId = parsePositiveIntParam(sessionIdParam) ?? undefined;
  const { markSeen, statusBySession } = useAnalysisTracker();
  const { data, error, refetch } = useSessionAnalysis(sessionId);

  useEffect(() => {
    if (sessionId !== undefined) markSeen(sessionId);
  }, [sessionId, markSeen]);

  const refetchResult = useCallback(() => {
    void refetch();
  }, [refetch]);

  const recordAgain = useCallback(() => {
    if (data === undefined || data.workoutId === null) return;
    router.push({
      pathname: "/record-set",
      params: {
        workoutId: String(data.workoutId),
        ...(data.openWorkoutRunId !== null && {
          runId: String(data.openWorkoutRunId),
        }),
        ...(data.setNumber !== null && { setNumber: String(data.setNumber) }),
        exerciseCode: data.exerciseCode,
        exerciseDisplayName: data.exerciseDisplayName,
        source: "standalone",
      },
    });
  }, [data]);

  const liveEvent =
    sessionId === undefined ? undefined : statusBySession[sessionId];

  let state: AnalysisResultState = "loading";
  if (data !== undefined) {
    state = data.outcome === "SCORED" ? "scored" : "untrackable";
  } else if (error !== null) {
    state =
      error instanceof ApiError && error.status === Number(StatusCodes.CONFLICT)
        ? "notReady"
        : "error";
  } else if (sessionId === undefined) {
    state = "error";
  }

  return {
    state,
    analysis: data,
    liveEvent,
    refetch: refetchResult,
    recordAgain: data?.workoutId === null ? undefined : recordAgain,
  };
};
