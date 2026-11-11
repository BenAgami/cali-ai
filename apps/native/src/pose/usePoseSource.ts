import { useMediaPipePose } from "./useMediaPipePose";
import type { UsePoseSourceOptions } from "./types";

/**
 * The single seam the app uses for pose estimation. The runtime is chosen by
 * 05-POSE-RUNTIME-DECISION.md (MediaPipe PoseLandmarker via
 * react-native-mediapipe-posedetection); swap the body here to change it.
 */
export const usePoseSource = (options: UsePoseSourceOptions) =>
  useMediaPipePose(options);
