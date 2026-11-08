import { useCallback, useState } from "react";
import type { PoseCapturePayload } from "@repo/common";

import { ApiError, sessionsApi } from "@src/api";
import { useAnalysisStatus } from "./useAnalysisStatus";

type PipelinePhase = "idle" | "creating" | "uploading" | "watching" | "error";

const EXERCISE_CODE = "push_up";
const SYNTHETIC_FPS = 15;
const SYNTHETIC_FRAME_COUNT = 60;
const SYNTHETIC_KEYPOINTS = 17;
const SYNTHETIC_DURATION_SEC = 4;
const FALLBACK_ERROR = "Something went wrong. Please try again.";

const buildSyntheticCapture = (): PoseCapturePayload => ({
  version: 1,
  poseModelName: "synthetic",
  poseModelVersion: "0",
  fps: SYNTHETIC_FPS,
  durationSec: SYNTHETIC_DURATION_SEC,
  frameCount: SYNTHETIC_FRAME_COUNT,
  cameraView: "side",
  frames: Array.from({ length: SYNTHETIC_FRAME_COUNT }, (_, i) => ({
    timestampSec: i / SYNTHETIC_FPS,
    keypoints: Array.from(
      { length: SYNTHETIC_KEYPOINTS },
      (): [number, number, number] => [0.5, 0.5, 0.9],
    ),
  })),
});

const toMessage = (err: unknown): string =>
  err instanceof ApiError ? err.message : FALLBACK_ERROR;

export const usePipelineCheck = () => {
  const [phase, setPhase] = useState<PipelinePhase>("idle");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { event, error: streamError } = useAnalysisStatus(sessionId, jobId);

  const run = useCallback(async () => {
    setErrorMessage(null);
    setJobId(null);
    setSessionId(null);
    try {
      setPhase("creating");
      const session = await sessionsApi.create(EXERCISE_CODE);
      setPhase("uploading");
      const accepted = await sessionsApi.submitCapture(
        session.id,
        buildSyntheticCapture(),
      );
      setSessionId(session.id);
      setJobId(accepted.jobId);
      setPhase("watching");
    } catch (err) {
      setErrorMessage(toMessage(err));
      setPhase("error");
    }
  }, []);

  const retry = useCallback(async () => {
    if (sessionId === null) return;
    setErrorMessage(null);
    try {
      const accepted = await sessionsApi.retryAnalysis(sessionId);
      setJobId(accepted.jobId);
      setPhase("watching");
    } catch (err) {
      setErrorMessage(toMessage(err));
      setPhase("error");
    }
  }, [sessionId]);

  const isTerminal =
    event?.status === "COMPLETED" || event?.status === "FAILED";
  const isBusy =
    phase === "creating" ||
    phase === "uploading" ||
    (phase === "watching" && !isTerminal);

  return {
    phase,
    sessionId,
    jobId,
    event,
    streamError,
    errorMessage,
    run,
    retry,
    isBusy,
    canRetry: event?.status === "FAILED",
  };
};
