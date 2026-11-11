import { useCallback, useMemo, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import type { CameraDevice, Orientation } from "react-native-vision-camera";
import {
  Delegate,
  RunningMode,
  usePoseDetection,
  type DetectionError,
  type MediaPipeSolution,
  type PoseDetectionResultBundle,
} from "react-native-mediapipe-posedetection";

import type {
  PoseFrame,
  PoseKeypoint,
  PoseSource,
  PoseSourceInfo,
  UsePoseSourceOptions,
} from "./types";

const MODEL_FILE = "pose_landmarker_full.task";
const PLUGIN_VERSION = "0.4.0";
const KEYPOINT_COUNT = 33;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * The plugin reports landmarks in the raw landscape sensor frame (aspectRatio
 * is 4:3 wide in both screen modes). Portrait needs the landmarks turned into
 * the upright frame; the turn differs per camera because the sensors are
 * mounted 180 degrees apart (back sensor landscape-left, front landscape-right).
 * Derived from raw nose/shoulder/ankle readings of an upright person facing the
 * camera (S25+, portrait); both turns are pure rotations, so the output is an
 * unmirrored, upright view with correct left/right labels on both cameras
 * (verified: raised right hand is the right-chain wrist). Android does not
 * mirror frame-processor frames, so there is nothing to un-mirror.
 */
const toUpright = (
  x: number,
  y: number,
  isFront: boolean,
  isPortrait: boolean,
  isLandscapeFlipped: boolean,
): [x: number, y: number] => {
  if (!isPortrait) return isLandscapeFlipped ? [1 - x, 1 - y] : [x, y];
  return isFront ? [y, 1 - x] : [1 - y, x];
};

/**
 * The raw landscape frame is upright in one landscape direction only: the back
 * sensor matches "landscape-left", the front sensor "landscape-right" (the
 * sensors sit 180 degrees apart). Held the other way the frame is upside down,
 * which is a pure 180 degree turn. Until the camera reports an orientation the
 * frame is assumed to match. Orientation names follow vision-camera; the
 * mapping is checked on device in the 05-18 UAT.
 */
const isLandscapeFlippedFor = (
  orientation: Orientation | null,
  isFront: boolean,
): boolean => {
  if (orientation === null) return false;
  if (orientation === "landscape-left" || orientation === "landscape-right") {
    return orientation !== (isFront ? "landscape-right" : "landscape-left");
  }
  return false;
};

const emptyKeypoints = (): PoseKeypoint[] =>
  Array.from({ length: KEYPOINT_COUNT }, (): PoseKeypoint => [0, 0, 0]);

type MediaPipePoseSource = PoseSource & {
  delegate: "GPU" | "CPU";
  lastError: string | null;
  cameraHandlers: {
    onLayout: (event: LayoutChangeEvent) => void;
    onOutputOrientationChanged: (orientation: Orientation) => void;
    onDeviceChange: (device: CameraDevice | undefined) => void;
  };
};

export const useMediaPipePose = (
  options: UsePoseSourceOptions,
): MediaPipePoseSource => {
  const { isActive, cameraPosition, isPortrait, targetFps, onFrame } = options;
  const [delegate, setDelegate] = useState<"GPU" | "CPU">("GPU");
  const [info, setInfo] = useState<PoseSourceInfo | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const hasReceivedResult = useRef(false);
  const startMs = useRef(Date.now());
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const cameraPositionRef = useRef(cameraPosition);
  cameraPositionRef.current = cameraPosition;
  const isPortraitRef = useRef(isPortrait);
  isPortraitRef.current = isPortrait;
  const orientationRef = useRef<Orientation | null>(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // The plugin owns the frame processor and hands results to JS itself, so
  // there is no Worklets.createRunOnJS hop in this adapter.
  const onResults = useCallback((bundle: PoseDetectionResultBundle) => {
    if (!isActiveRef.current) return;
    hasReceivedResult.current = true;
    const landmarks = bundle.results[0]?.landmarks[0];
    const isFront = cameraPositionRef.current === "front";
    const isLandscapeFlipped = isLandscapeFlippedFor(
      orientationRef.current,
      isFront,
    );
    const keypoints: PoseKeypoint[] =
      landmarks && landmarks.length === KEYPOINT_COUNT
        ? landmarks.map((landmark): PoseKeypoint => {
            const [x, y] = toUpright(
              clamp01(landmark.x),
              clamp01(landmark.y),
              isFront,
              isPortraitRef.current,
              isLandscapeFlipped,
            );
            return [x, y, clamp01(landmark.visibility ?? 0)];
          })
        : emptyKeypoints();
    const frame: PoseFrame = {
      timestampSec: (Date.now() - startMs.current) / 1000,
      keypoints,
    };
    if (bundle.inputImageHeight > 0) {
      const sensorAspectRatio =
        bundle.inputImageWidth / bundle.inputImageHeight;
      const aspectRatio = isPortraitRef.current
        ? 1 / sensorAspectRatio
        : sensorAspectRatio;
      setInfo((previous) =>
        previous && previous.aspectRatio === aspectRatio
          ? previous
          : {
              poseModelName: "blazepose_full",
              poseModelVersion: `${MODEL_FILE}@${PLUGIN_VERSION}`,
              aspectRatio,
            },
      );
    }
    onFrameRef.current(frame);
  }, []);

  const onError = useCallback((error: DetectionError) => {
    setLastError(error.message);
    if (!hasReceivedResult.current) setDelegate("CPU");
  }, []);

  const solution: MediaPipeSolution = usePoseDetection(
    { onResults, onError },
    RunningMode.LIVE_STREAM,
    MODEL_FILE,
    {
      numPoses: 1,
      delegate: delegate === "GPU" ? Delegate.GPU : Delegate.CPU,
      fpsMode: targetFps,
      mirrorMode: "no-mirror",
    },
  );

  const { cameraOrientationChangedHandler } = solution;
  const onOutputOrientationChanged = useCallback(
    (orientation: Orientation) => {
      orientationRef.current = orientation;
      cameraOrientationChangedHandler(orientation);
    },
    [cameraOrientationChangedHandler],
  );

  const cameraHandlers = useMemo(
    () => ({
      onLayout: solution.cameraViewLayoutChangeHandler,
      onOutputOrientationChanged,
      onDeviceChange: solution.cameraDeviceChangeHandler,
    }),
    [
      solution.cameraViewLayoutChangeHandler,
      onOutputOrientationChanged,
      solution.cameraDeviceChangeHandler,
    ],
  );

  return {
    isReady: true,
    info,
    frameProcessor: solution.frameProcessor,
    delegate,
    lastError,
    cameraHandlers,
  };
};
