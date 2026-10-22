import { useCallback, useState } from "react";
import {
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from "react-native-vision-camera";
import { useTensorflowModel } from "react-native-fast-tflite";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { Worklets } from "react-native-worklets-core";

// Metro resolves bundled assets only through a static require().
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const MODEL_SOURCE = require("../../assets/models/movenet_singlepose_lightning_int8.tflite");

const MODEL_INPUT_SIZE = 192;
const KEYPOINT_COUNT = 17;
const KEYPOINT_VALUES = 3;
const SCORE_THRESHOLD = 0.3;
const TARGET_FPS = 5;

type CameraPosition = "back" | "front";

type PoseStats = {
  framesProcessed: number;
  detectedKeypoints: number;
  meanScore: number;
  inferenceMs: number;
};

type PoseSample = Omit<PoseStats, "framesProcessed">;

const INITIAL_STATS: PoseStats = {
  framesProcessed: 0,
  detectedKeypoints: 0,
  meanScore: 0,
  inferenceMs: 0,
};

export const usePoseCheck = () => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [position, setPosition] = useState<CameraPosition>("back");
  const device = useCameraDevice(position);
  const model = useTensorflowModel(
    MODEL_SOURCE as Parameters<typeof useTensorflowModel>[0],
  );
  const resizePlugin = useResizePlugin();
  const [stats, setStats] = useState<PoseStats>(INITIAL_STATS);

  const toggleCamera = useCallback(() => {
    setPosition((current) => (current === "back" ? "front" : "back"));
  }, []);

  const actualModel = model.state === "loaded" ? model.model : undefined;

  const reportSample = Worklets.createRunOnJS((sample: PoseSample) => {
    setStats((previous) => ({
      ...sample,
      framesProcessed: previous.framesProcessed + 1,
    }));
  });

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      if (actualModel == null) return;

      runAtTargetFps(TARGET_FPS, () => {
        "worklet";
        const start = performance.now();
        const input = resizePlugin.resize(frame, {
          scale: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE },
          pixelFormat: "rgb",
          dataType: "uint8",
        });
        const outputs = actualModel.runSync([input]);
        const keypoints = outputs[0];

        let detected = 0;
        let total = 0;
        for (let i = 0; i < KEYPOINT_COUNT; i++) {
          const score = Number(keypoints[i * KEYPOINT_VALUES + 2]);
          total += score;
          if (score >= SCORE_THRESHOLD) detected++;
        }

        void reportSample({
          detectedKeypoints: detected,
          meanScore: total / KEYPOINT_COUNT,
          inferenceMs: performance.now() - start,
        });
      });
    },
    [actualModel, resizePlugin, reportSample],
  );

  return {
    hasPermission,
    requestPermission,
    device,
    toggleCamera,
    modelState: model.state,
    frameProcessor,
    stats,
  };
};
