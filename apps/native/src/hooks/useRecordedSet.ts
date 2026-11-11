import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
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
  evaluateSetEnd,
  evaluateSetup,
  exitEdgeOf,
  FORM_CAPTURE_SETUP,
  getMissingAiPrerequisites,
  SETUP_WINDOW_FRAMES,
  type AiPrerequisiteCode,
  type FormAnalysisExercise,
  type PoseCapturePayload,
  type SetupCheckResult,
  type SetupIssue,
} from "@repo/common";

import { ApiError, sessionsApi } from "@src/api";
import {
  SETUP_ISSUE_MESSAGES,
  SPOKEN_ISSUE_MESSAGES,
  UPLOAD_ERROR_MESSAGES,
  WRONG_ANGLE_PULL_UP_MESSAGE,
  type UploadErrorCode,
} from "@src/constants/recordingMessages";
import { useAnalysisTracker } from "@src/context/AnalysisTrackerContext";
import { useProfile } from "@src/hooks/queries/useProfile";
import { useSpokenCues } from "@src/hooks/useSpokenCues";
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

/** Seconds of continuously good placement before recording starts by itself. */
const COUNTDOWN_SECS = 5;
const AUTO_STOP_SEC = 175;
const RECORDING_TARGET_FPS = 15;

/** runAtTargetFps value that gives the camera's native ~30 fps (15 quantises to ~12). */
const POSE_SOURCE_TARGET_FPS = 60;
const SETUP_EVAL_INTERVAL_MS = 250;
const FRAME_STALE_MS = 1000;
/** How long after the body vanishes the edge it left through is still named. */
const EXIT_MEMORY_MS = 5000;
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

/**
 * Landmarks are unmirrored, but the front preview is mirrored, so a body cut
 * off at the left of the landmark frame is cut off at the right of the screen.
 */
const toScreenIssue = (
  issue: SetupIssue,
  cameraPosition: "front" | "back",
): SetupIssue => {
  if (cameraPosition !== "front") return issue;
  if (issue === "CLIPPED_LEFT") return "CLIPPED_RIGHT";
  if (issue === "CLIPPED_RIGHT") return "CLIPPED_LEFT";
  return issue;
};

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

  // vision-camera's Android OrientationManager starts from ROTATION_0 and only
  // learns the display rotation from change events that arrive after its
  // listener is registered, late in session configuration. A screen already
  // rotated when the Camera mounts therefore leaves the preview 90 degrees off
  // until the next rotation event. So the Camera mounts in portrait (matching
  // that start value) and the screen is turned once the preview is streaming, the
  // same sequence as the BlazePose dev screen. The screen stays covered until
  // the window has the capture orientation (see record-set.tsx).
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isOrientationReady =
    FORM_CAPTURE_SETUP[exerciseCode].orientation === "landscape"
      ? windowWidth > windowHeight
      : windowHeight > windowWidth;

  const [isPreviewStarted, setIsPreviewStarted] = useState(false);
  const onPreviewStarted = useCallback(() => {
    setIsPreviewStarted(true);
  }, []);
  useEffect(() => {
    if (
      isPreviewStarted &&
      FORM_CAPTURE_SETUP[exerciseCode].orientation === "landscape"
    ) {
      void ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE,
      );
    }
  }, [isPreviewStarted, exerciseCode]);
  useEffect(
    () => () => {
      void ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    },
    [],
  );

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
      const lastFrame = windowRef.current[windowRef.current.length - 1];
      const result = isStale
        ? {
            isReady: false,
            issue:
              (lastFrame &&
                now - lastFrameAtRef.current < EXIT_MEMORY_MS &&
                exitEdgeOf(lastFrame)) ||
              "NOT_DETECTED",
          }
        : evaluateSetup({
            frames: windowRef.current,
            exerciseCode,
            aspectRatio: aspectRatioRef.current,
            // The pose plugin owns the frame processor, so no luma is available.
            lumaMean: null,
          });
      setSetupResult((previous) =>
        previous.isReady === result.isReady && previous.issue === result.issue
          ? previous
          : result,
      );
    }, SETUP_EVAL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isChecking, exerciseCode]);

  const isPlacementReady = setupResult.isReady;

  // Hands-free start: the user is away from the phone, so good placement
  // starts the countdown and losing it cancels the countdown.
  useEffect(() => {
    if (phase === "setup" && isPlacementReady) {
      setCountdownSecondsLeft(COUNTDOWN_SECS);
      setStage("countdown");
    } else if (phase === "countdown" && !isPlacementReady) {
      setStage("setup");
    }
  }, [phase, isPlacementReady]);

  useEffect(() => {
    if (phase !== "countdown") return;
    const timer = setInterval(() => {
      setCountdownSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, SECOND_MS);
    return () => clearInterval(timer);
  }, [phase]);

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

  // keepCount drops the idle tail after the set (see evaluateSetEnd).
  const finish = useCallback(
    (keepCount?: number) => {
      if (phaseRef.current !== "recording") return;
      const recorded = bufferRef.current;
      const frames =
        keepCount === undefined ? recorded : recorded.slice(0, keepCount);
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
    },
    [exerciseCode, poseInfo, runUpload],
  );
  const stop = useCallback(() => {
    finish();
  }, [finish]);

  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => {
      const seconds = Math.floor(
        (Date.now() - recordingStartedAtRef.current) / SECOND_MS,
      );
      setElapsedSec(seconds);
      // The user is away from the phone, so the set ends by itself when the
      // body leaves the frame or stands still; the time limit is the backstop.
      const lastFrame = latestFrameRef.current;
      const verdict = evaluateSetEnd({
        frames: bufferRef.current,
        exerciseCode,
        // Frames stop while nobody is detected, so measure from the clock.
        nowSec: lastFrame
          ? lastFrame.timestampSec +
            (Date.now() - lastFrameAtRef.current) / SECOND_MS
          : undefined,
      });
      if (verdict.isOver) finishRef.current(verdict.keepCount);
      else if (seconds >= AUTO_STOP_SEC) finishRef.current();
    }, SECOND_MS);
    return () => clearInterval(timer);
  }, [phase, exerciseCode]);

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
    lastKeptSecRef.current = Number.NEGATIVE_INFINITY;
    setSetupResult(NOT_READY);
    setCameraPosition((position) => (position === "front" ? "back" : "front"));
  }, []);

  const setupIssue = setupResult.issue;
  const setupMessage =
    setupIssue === null
      ? null
      : setupIssue === "WRONG_ANGLE" && exerciseCode === "pull_up"
        ? WRONG_ANGLE_PULL_UP_MESSAGE
        : SETUP_ISSUE_MESSAGES[toScreenIssue(setupIssue, cameraPosition)];

  const spokenGuidance =
    setupIssue === null
      ? null
      : setupIssue === "WRONG_ANGLE" && exerciseCode === "pull_up"
        ? WRONG_ANGLE_PULL_UP_MESSAGE
        : SPOKEN_ISSUE_MESSAGES[toScreenIssue(setupIssue, cameraPosition)];
  useSpokenCues({ phase, guidance: spokenGuidance, countdownSecondsLeft });

  const isUploadRetryable = uploadErrorCode === "UPLOAD_FAILED";

  return {
    phase,
    missingPrerequisites,
    isLoadingPrerequisites,
    refetchPrerequisites: refetchProfile,
    hasPermission,
    requestPermission,
    device,
    isOrientationReady,
    onPreviewStarted,
    cameraPosition,
    toggleCamera,
    frameProcessor: pose.frameProcessor,
    isPoseReady: pose.isReady,
    cameraHandlers,
    latestFrameRef,
    setupIssue,
    setupMessage,
    isPlacementReady,
    countdownSecondsLeft,
    elapsedSec,
    stop,
    discard,
    uploadError:
      uploadErrorCode === null ? null : UPLOAD_ERROR_MESSAGES[uploadErrorCode],
    isUploadRetryable,
    retryUpload,
  };
};
