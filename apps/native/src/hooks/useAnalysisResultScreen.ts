import { useCallback, useEffect } from "react";
import { router } from "expo-router";
import type { AnalysisStatusEvent, FormAnalysisResponse } from "@repo/common";

import { ApiError } from "@src/api";
import { useAnalysisTracker } from "@src/context/AnalysisTrackerContext";
import { useSessionAnalysis } from "@src/hooks/queries/useSessionAnalysis";

const CONFLICT_STATUS = 409;

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

const parseSessionId = (param: string | undefined): number | undefined => {
  if (param === undefined) return undefined;
  const parsed = Number(param);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const useAnalysisResultScreen = (
  sessionIdParam: string | undefined,
): AnalysisResultScreen => {
  const sessionId = parseSessionId(sessionIdParam);
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
        setNumber: data.setNumber === null ? "" : String(data.setNumber),
        exerciseCode: data.exerciseCode,
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
      error instanceof ApiError && error.status === CONFLICT_STATUS
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
