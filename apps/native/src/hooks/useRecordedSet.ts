import { useCallback, useEffect, useRef, useState } from "react";
import Constants from "expo-constants";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as ScreenOrientation from "expo-screen-orientation";
import {
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import {
  buildPoseCapturePayload,
  CAPTURE_LIMITS,
  evaluateSetup,
  FORM_CAPTURE_SETUP,
  getMissingAiPrerequisites,
  SETUP_WINDOW_FRAMES,
  type AiPrerequisiteCode,
  type FormAnalysisExercise,
  type PoseCapturePayload,
  type SetupCheckResult,
} from "@repo/common";

import { ApiError, sessionsApi } from "@src/api";
import {
  SETUP_ISSUE_MESSAGES,
  UPLOAD_ERROR_MESSAGES,
  WRONG_ANGLE_PULL_UP_MESSAGE,
  type UploadErrorCode,
} from "@src/constants/recordingMessages";
import { useAnalysisTracker } from "@src/context/AnalysisTrackerContext";
import { useProfile } from "@src/hooks/queries/useProfile";
import type { PoseFrame } from "@src/pose/types";
import { usePoseSource } from "@src/pose/usePoseSource";
import { markRecordedSetDone } from "@src/state/recordedSetStore";

export type RecordedSetPhase =
  | "prerequisites"
  | "permission"
  | "setup"
  | "countdown"
  | "recording"
  | "uploading"
  | "uploadError"
  | "submitted";

type Stage =
  | "setup"
  | "countdown"
  | "recording"
  | "uploading"
  | "uploadError"
  | "submitted";

const COUNTDOWN_SECS = 8;
const AUTO_STOP_SEC = 175;
const RECORDING_TARGET_FPS = 15;

/** runAtTargetFps value that gives the camera's native ~30 fps (15 quantises to ~12). */
const POSE_SOURCE_TARGET_FPS = 60;
const SETUP_EVAL_INTERVAL_MS = 250;
const READY_HOLD_MS = 1000;
const FRAME_STALE_MS = 1000;
const WINDOW_FRAMES = SETUP_WINDOW_FRAMES * 2;
const SECOND_MS = 1000;
/** Keep 90% of the capture interval so ~33 ms frames thin cleanly to 15 fps. */
const MIN_FRAME_GAP_SEC = (1 / RECORDING_TARGET_FPS) * 0.9;
const DEFAULT_ASPECT_RATIO = 9 / 16;
const HTTP_PRECONDITION_REQUIRED = 428;
const HTTP_TOO_MANY_REQUESTS = 429;
const DAILY_LIMIT_CODE = "DAILY_ANALYSIS_LIMIT_REACHED";
const EXERCISE_LIMIT_CODE = "EXERCISE_ANALYSIS_LIMIT_REACHED";
const KEEP_AWAKE_TAG = "recorded-set";

const NOT_READY: SetupCheckResult = { isReady: false, issue: "NOT_DETECTED" };

const toUploadErrorCode = (error: unknown): UploadErrorCode => {
  if (error instanceof ApiError && error.status === HTTP_TOO_MANY_REQUESTS) {
    if (error.code === DAILY_LIMIT_CODE) return "DAILY_LIMIT";
    if (error.code === EXERCISE_LIMIT_CODE) return "EXERCISE_LIMIT";
  }
  return "UPLOAD_FAILED";
};

interface UseRecordedSetParams {
  workoutId: number | null;
  setNumber: number | null;
  exerciseCode: FormAnalysisExercise;
  exerciseDisplayName: string;
  source: "execute" | "standalone";
  onSubmitted: () => void;
}

export const useRecordedSet = (params: UseRecordedSetParams) => {
  const {
    workoutId,
    setNumber,
    exerciseCode,
    exerciseDisplayName,
    source,
    onSubmitted,
  } = params;
  const { track } = useAnalysisTracker();
  const { data: profile, refetch: refetchProfile } = useProfile();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<"front" | "back">(
    "front",
  );
  const device = useCameraDevice(cameraPosition);

  const [stage, setStage] = useState<Stage>("setup");
  const [setupResult, setSetupResult] = useState<SetupCheckResult>(NOT_READY);
  const [canStart, setCanStart] = useState(false);
  const [countdownSecondsLeft, setCountdownSecondsLeft] =
    useState(COUNTDOWN_SECS);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [uploadErrorCode, setUploadErrorCode] =
    useState<UploadErrorCode | null>(null);

  const missingPrerequisites: AiPrerequisiteCode[] = profile
    ? getMissingAiPrerequisites({
        experienceLevel: profile.experienceLevel,
        hasActiveGoal: profile.goals.length > 0,
        hasBodyMetric: profile.bodyMetric !== null,
        aiConsentVersion: profile.aiConsentVersion,
      })
    : [];
  const isLoadingPrerequisites = profile === undefined;

  let phase: RecordedSetPhase = stage;
  if (stage === "setup") {
    if (isLoadingPrerequisites || missingPrerequisites.length > 0) {
      phase = "prerequisites";
    } else if (!hasPermission) {
      phase = "permission";
    }
  }
  const isPoseActive =
    phase === "setup" || phase === "countdown" || phase === "recording";

  const phaseRef = useRef<RecordedSetPhase>(phase);
  phaseRef.current = phase;
  const onSubmittedRef = useRef(onSubmitted);
  onSubmittedRef.current = onSubmitted;
  const latestFrameRef = useRef<PoseFrame | null>(null);
  const windowRef = useRef<PoseFrame[]>([]);
  const bufferRef = useRef<PoseFrame[]>([]);
  const lastKeptSecRef = useRef(Number.NEGATIVE_INFINITY);
  const lastFrameAtRef = useRef(0);
  const readySinceRef = useRef<number | null>(null);
  const aspectRatioRef = useRef(DEFAULT_ASPECT_RATIO);
  const payloadRef = useRef<PoseCapturePayload | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);

  // Frame callback: touches refs only, never state (it runs ~30 times a second).
  const onFrame = useCallback((frame: PoseFrame) => {
    latestFrameRef.current = frame;
    lastFrameAtRef.current = Date.now();
    if (frame.timestampSec - lastKeptSecRef.current < MIN_FRAME_GAP_SEC) {
      return;
    }
    lastKeptSecRef.current = frame.timestampSec;
    const recent = windowRef.current;
    recent.push(frame);
    if (recent.length > WINDOW_FRAMES) recent.shift();
    if (
      phaseRef.current === "recording" &&
      bufferRef.current.length < CAPTURE_LIMITS.maxFrames
    ) {
      bufferRef.current.push(frame);
    }
  }, []);

  const pose = usePoseSource({
    isActive: isPoseActive,
    cameraPosition,
    isPortrait: FORM_CAPTURE_SETUP[exerciseCode].orientation === "portrait",
    targetFps: POSE_SOURCE_TARGET_FPS,
    onFrame,
  });
  const { info: poseInfo, cameraHandlers } = pose;
  const { onDeviceChange } = cameraHandlers;
  if (poseInfo) aspectRatioRef.current = poseInfo.aspectRatio;

  useEffect(() => {
    onDeviceChange(device);
  }, [device, onDeviceChange]);

  // Lock orientation to the exercise's capture orientation.
  useEffect(() => {
    if (FORM_CAPTURE_SETUP[exerciseCode].orientation === "landscape") {
      void ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE,
      );
    }
    return () => {
      void ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    };
  }, [exerciseCode]);

  const isAwake =
    phase === "setup" ||
    phase === "countdown" ||
    phase === "recording" ||
    phase === "uploading";
  useEffect(() => {
    if (!isAwake) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [isAwake]);

  // Live setup check on a JS interval, not per frame.
  const isChecking = phase === "setup" || phase === "countdown";
  useEffect(() => {
    if (!isChecking) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const isStale = now - lastFrameAtRef.current > FRAME_STALE_MS;
      const result = isStale
        ? NOT_READY
        : evaluateSetup({
            frames: windowRef.current,
            exerciseCode,
            aspectRatio: aspectRatioRef.current,
            // The pose plugin owns the frame processor, so no luma is available.
            lumaMean: null,
          });
      if (result.isReady) {
        readySinceRef.current ??= now;
      } else {
        readySinceRef.current = null;
      }
      const hasHeldReady =
        readySinceRef.current !== null &&
        now - readySinceRef.current >= READY_HOLD_MS;
      setCanStart(hasHeldReady);
      setSetupResult((previous) =>
        previous.isReady === result.isReady && previous.issue === result.issue
          ? previous
          : result,
      );
    }, SETUP_EVAL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isChecking, exerciseCode]);

  const isCountdownPaused = phase === "countdown" && !setupResult.isReady;

  const start = useCallback(() => {
    if (phaseRef.current !== "setup") return;
    setCountdownSecondsLeft(COUNTDOWN_SECS);
    setStage("countdown");
  }, []);

  useEffect(() => {
    if (phase !== "countdown" || isCountdownPaused) return;
    const timer = setInterval(() => {
      setCountdownSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, SECOND_MS);
    return () => clearInterval(timer);
  }, [phase, isCountdownPaused]);

  useEffect(() => {
    if (phase !== "countdown" || countdownSecondsLeft > 0) return;
    bufferRef.current = [];
    recordingStartedAtRef.current = Date.now();
    setElapsedSec(0);
    setStage("recording");
  }, [phase, countdownSecondsLeft]);

  const runUpload = useCallback(async () => {
    const payload = payloadRef.current;
    if (!payload) return;
    setUploadErrorCode(null);
    setStage("uploading");
    try {
      sessionIdRef.current ??= (
        await sessionsApi.create({
          exerciseCode,
          workoutId: workoutId ?? undefined,
          setNumber: setNumber ?? undefined,
        })
      ).id;
      const sessionId = sessionIdRef.current;
      const accepted = await sessionsApi.submitCapture(sessionId, payload);
      track({
        sessionId,
        jobId: accepted.jobId,
        workoutId,
        setNumber,
        exerciseCode,
        exerciseDisplayName,
      });
      if (source === "execute" && workoutId !== null && setNumber !== null) {
        markRecordedSetDone({ workoutId, setNumber });
      }
      payloadRef.current = null;
      setStage("submitted");
      onSubmittedRef.current();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === HTTP_PRECONDITION_REQUIRED
      ) {
        void refetchProfile();
        setStage("setup");
        return;
      }
      setUploadErrorCode(toUploadErrorCode(error));
      setStage("uploadError");
    }
  }, [
    exerciseCode,
    exerciseDisplayName,
    refetchProfile,
    setNumber,
    source,
    track,
    workoutId,
  ]);

  const stop = useCallback(() => {
    if (phaseRef.current !== "recording") return;
    const frames = bufferRef.current;
    bufferRef.current = [];
    if (frames.length === 0) {
      // The pose source delivered nothing; there is nothing to upload.
      setStage("setup");
      return;
    }
    payloadRef.current = buildPoseCapturePayload(frames, {
      poseModelName: poseInfo?.poseModelName ?? "blazepose_full",
      poseModelVersion: poseInfo?.poseModelVersion ?? "unknown",
      aspectRatio: aspectRatioRef.current,
      cameraView: FORM_CAPTURE_SETUP[exerciseCode].cameraView,
      appVersion: Constants.expoConfig?.version,
    });
    void runUpload();
  }, [exerciseCode, poseInfo, runUpload]);

  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => {
      const seconds = Math.floor(
        (Date.now() - recordingStartedAtRef.current) / SECOND_MS,
      );
      setElapsedSec(seconds);
      if (seconds >= AUTO_STOP_SEC) stopRef.current();
    }, SECOND_MS);
    return () => clearInterval(timer);
  }, [phase]);

  const retryUpload = useCallback(() => {
    void runUpload();
  }, [runUpload]);

  const discard = useCallback(() => {
    payloadRef.current = null;
    sessionIdRef.current = null;
    bufferRef.current = [];
    setUploadErrorCode(null);
    setStage("setup");
  }, []);

  const toggleCamera = useCallback(() => {
    windowRef.current = [];
    readySinceRef.current = null;
    lastKeptSecRef.current = Number.NEGATIVE_INFINITY;
    setCanStart(false);
    setSetupResult(NOT_READY);
    setCameraPosition((position) => (position === "front" ? "back" : "front"));
  }, []);

  const setupIssue = setupResult.issue;
  const setupMessage =
    setupIssue === null
      ? null
      : setupIssue === "WRONG_ANGLE" && exerciseCode === "pull_up"
        ? WRONG_ANGLE_PULL_UP_MESSAGE
        : SETUP_ISSUE_MESSAGES[setupIssue];

  const isUploadRetryable = uploadErrorCode === "UPLOAD_FAILED";

  return {
    phase,
    missingPrerequisites,
    isLoadingPrerequisites,
    refetchPrerequisites: refetchProfile,
    hasPermission,
    requestPermission,
    device,
    cameraPosition,
    toggleCamera,
    frameProcessor: pose.frameProcessor,
    isPoseReady: pose.isReady,
    cameraHandlers,
    latestFrameRef,
    setupIssue,
    setupMessage,
    canStart,
    start,
    countdownSecondsLeft,
    isCountdownPaused,
    elapsedSec,
    stop,
    discard,
    uploadError:
      uploadErrorCode === null ? null : UPLOAD_ERROR_MESSAGES[uploadErrorCode],
    isUploadRetryable,
    retryUpload,
  };
};
