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

/** Flip after the on-device mirroring check (C7). The plugin returns raw frame-space x. */
const IS_FRONT_OUTPUT_MIRRORED = false;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

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
  const { isActive, cameraPosition, targetFps, onFrame } = options;
  const [delegate, setDelegate] = useState<"GPU" | "CPU">("GPU");
  const [info, setInfo] = useState<PoseSourceInfo | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const hasReceivedResult = useRef(false);
  const startMs = useRef(Date.now());
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const cameraPositionRef = useRef(cameraPosition);
  cameraPositionRef.current = cameraPosition;
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // The plugin owns the frame processor and hands results to JS itself, so
  // there is no Worklets.createRunOnJS hop in this adapter.
  const onResults = useCallback((bundle: PoseDetectionResultBundle) => {
    if (!isActiveRef.current) return;
    hasReceivedResult.current = true;
    const landmarks = bundle.results[0]?.landmarks[0];
    const isFront = cameraPositionRef.current === "front";
    const shouldUnmirror = isFront && IS_FRONT_OUTPUT_MIRRORED;
    const keypoints: PoseKeypoint[] =
      landmarks && landmarks.length === KEYPOINT_COUNT
        ? landmarks.map((landmark): PoseKeypoint => {
            const x = clamp01(landmark.x);
            return [
              shouldUnmirror ? 1 - x : x,
              clamp01(landmark.y),
              clamp01(landmark.visibility ?? 0),
            ];
          })
        : emptyKeypoints();
    const frame: PoseFrame = {
      timestampSec: (Date.now() - startMs.current) / 1000,
      keypoints,
    };
    if (bundle.inputImageHeight > 0) {
      const aspectRatio = bundle.inputImageWidth / bundle.inputImageHeight;
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

  const cameraHandlers = useMemo(
    () => ({
      onLayout: solution.cameraViewLayoutChangeHandler,
      onOutputOrientationChanged: solution.cameraOrientationChangedHandler,
      onDeviceChange: solution.cameraDeviceChangeHandler,
    }),
    [
      solution.cameraViewLayoutChangeHandler,
      solution.cameraOrientationChangedHandler,
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
