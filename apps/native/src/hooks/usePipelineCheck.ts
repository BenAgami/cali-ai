import { useCallback, useState } from "react";
import type { PoseCapturePayload } from "@repo/common";

import { ApiError, recordedSetsApi } from "@src/api";
import { useAnalysisStatus } from "./useAnalysisStatus";

type PipelinePhase = "idle" | "creating" | "uploading" | "watching" | "error";

const EXERCISE_CODE = "push_up";
const SYNTHETIC_FPS = 15;
const SYNTHETIC_FRAME_COUNT = 60;
const SYNTHETIC_KEYPOINTS = 33;
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
  const [recordedSetId, setRecordedSetId] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { event, error: streamError } = useAnalysisStatus(recordedSetId, jobId);

  const run = useCallback(async () => {
    setErrorMessage(null);
    setJobId(null);
    setRecordedSetId(null);
    try {
      setPhase("creating");
      const recordedSet = await recordedSetsApi.create({
        exerciseCode: EXERCISE_CODE,
      });
      setPhase("uploading");
      const accepted = await recordedSetsApi.submitCapture(
        recordedSet.id,
        buildSyntheticCapture(),
      );
      setRecordedSetId(recordedSet.id);
      setJobId(accepted.jobId);
      setPhase("watching");
    } catch (err) {
      setErrorMessage(toMessage(err));
      setPhase("error");
    }
  }, []);

  const retry = useCallback(async () => {
    if (recordedSetId === null) return;
    setErrorMessage(null);
    try {
      const accepted = await recordedSetsApi.retryAnalysis(recordedSetId);
      setJobId(accepted.jobId);
      setPhase("watching");
    } catch (err) {
      setErrorMessage(toMessage(err));
      setPhase("error");
    }
  }, [recordedSetId]);

  const isTerminal =
    event?.status === "COMPLETED" || event?.status === "FAILED";
  const isBusy =
    phase === "creating" ||
    phase === "uploading" ||
    (phase === "watching" && !isTerminal);

  return {
    phase,
    recordedSetId,
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
