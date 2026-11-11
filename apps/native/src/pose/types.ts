import type { ReadonlyFrameProcessor } from "react-native-vision-camera";

export type PoseKeypoint = [x: number, y: number, visibility: number];

/** 33 BlazePose landmarks, x/y normalised 0..1 to the upright (oriented) image, y down, NOT mirrored. */
export type PoseFrame = { timestampSec: number; keypoints: PoseKeypoint[] };

export type PoseSourceInfo = {
  poseModelName: "blazepose_full";
  /** e.g. "pose_landmarker_full.task@<plugin version>" */
  poseModelVersion: string;
  /** width / height of the oriented image the landmarks are normalised to */
  aspectRatio: number;
};

export type PoseSource = {
  isReady: boolean;
  info: PoseSourceInfo | null;
  frameProcessor: ReadonlyFrameProcessor | undefined;
};

export type UsePoseSourceOptions = {
  isActive: boolean;
  cameraPosition: "front" | "back";
  /** The plugin returns sensor-frame (landscape) landmarks; portrait needs a 90 degree turn. */
  isPortrait: boolean;
  /**
   * runAtTargetFps throttle. A value near half the camera rate (15 on a 30 fps
   * camera) quantises to ~10-12 fps; use 60 for unthrottled.
   */
  targetFps: number;
  /** Invoked on the JS thread. */
  onFrame: (frame: PoseFrame) => void;
};
