import {
  BLAZEPOSE,
  FORM_KEY_JOINTS,
  type FormAnalysisExercise,
} from "./formAnalysis";
import {
  CAPTURE_LIMITS,
  quantizeCapture,
  type PoseCapturePayload,
} from "./poseCapture";

export const SETUP_ISSUES = [
  "NOT_DETECTED",
  "TOO_DARK",
  "CLIPPED_LEFT",
  "CLIPPED_RIGHT",
  "CLIPPED_TOP",
  "CLIPPED_BOTTOM",
  "TOO_FAR",
  "WRONG_ANGLE",
] as const;

export type SetupIssue = (typeof SETUP_ISSUES)[number];

export type SetupFrame = {
  timestampSec: number;
  keypoints: [number, number, number][];
};

export type SetupCheckResult = { isReady: boolean; issue: SetupIssue | null };

export const SETUP_WINDOW_FRAMES = 15;

const VISIBLE_MIN = 0.5;
const VISIBLE_FRAME_SHARE_MIN = 0.8;
const DARK_LUMA = 0.16;
const EDGE_MIN = 0.02;
const EDGE_MAX = 0.98;
const SPAN_MIN = 0.4;
const SIDE_SHOULDER_RATIO_MAX = 0.55;
const FRONT_SHOULDER_RATIO_MIN = 0.25;
const MIN_TORSO = 1e-6;

const READY: SetupCheckResult = { isReady: true, issue: null };
const notReady = (issue: SetupIssue): SetupCheckResult => ({
  isReady: false,
  issue,
});

const meanVisibility = (
  frames: readonly SetupFrame[],
  joints: readonly number[],
): number => {
  let sum = 0;
  let count = 0;
  for (const frame of frames) {
    for (const joint of joints) {
      sum += frame.keypoints[joint]?.[2] ?? 0;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
};

const distance = (dx: number, dy: number): number =>
  Math.sqrt(dx * dx + dy * dy);

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
};

const keyJointsFor = (
  exerciseCode: FormAnalysisExercise,
  frames: readonly SetupFrame[],
): readonly number[] => {
  const { left, right } = FORM_KEY_JOINTS[exerciseCode];
  if (exerciseCode === "pull_up") return [...left, ...right];
  return meanVisibility(frames, left) >= meanVisibility(frames, right)
    ? left
    : right;
};

const shoulderToTorsoRatio = (
  frame: SetupFrame,
  aspectRatio: number,
): number | null => {
  const ls = frame.keypoints[BLAZEPOSE.LEFT_SHOULDER];
  const rs = frame.keypoints[BLAZEPOSE.RIGHT_SHOULDER];
  const lh = frame.keypoints[BLAZEPOSE.LEFT_HIP];
  const rh = frame.keypoints[BLAZEPOSE.RIGHT_HIP];
  if (!ls || !rs || !lh || !rh) return null;
  const shoulderWidth = distance((ls[0] - rs[0]) * aspectRatio, ls[1] - rs[1]);
  const torso = distance(
    ((ls[0] + rs[0]) / 2 - (lh[0] + rh[0]) / 2) * aspectRatio,
    (ls[1] + rs[1]) / 2 - (lh[1] + rh[1]) / 2,
  );
  return torso < MIN_TORSO ? null : shoulderWidth / torso;
};

/**
 * Which frame edge cuts the body off. A joint outside the frame is no longer
 * confidently visible, so the visibility check fails first; but the pose model
 * still places it beyond the edge and the adapter clamps it to the boundary.
 * Counting hidden key joints at a boundary names the edge. Needs part of the
 * body to be detected, so an empty frame (all zeros) is never read as clipped.
 */
const clippedEdgeOf = (
  last: SetupFrame,
  keyJoints: readonly number[],
): SetupIssue | null => {
  const points = keyJoints.map((joint) => last.keypoints[joint]);
  const visibleCount = points.filter(
    (point) => (point?.[2] ?? 0) >= VISIBLE_MIN,
  ).length;
  if (visibleCount === 0) return null;
  const hidden = points.filter(
    (point): point is [number, number, number] =>
      point !== undefined && point[2] < VISIBLE_MIN,
  );
  const edges: [SetupIssue, number][] = [
    ["CLIPPED_LEFT", hidden.filter(([x]) => x <= EDGE_MIN).length],
    ["CLIPPED_RIGHT", hidden.filter(([x]) => x >= EDGE_MAX).length],
    ["CLIPPED_TOP", hidden.filter(([, y]) => y <= EDGE_MIN).length],
    ["CLIPPED_BOTTOM", hidden.filter(([, y]) => y >= EDGE_MAX).length],
  ];
  const [issue, count] = edges.reduce((best, edge) =>
    edge[1] > best[1] ? edge : best,
  );
  return count > 0 ? issue : null;
};

/** Pure live check that gates the Start button (05-RUBRICS section 10). */
export const evaluateSetup = (input: {
  frames: readonly SetupFrame[];
  exerciseCode: FormAnalysisExercise;
  aspectRatio: number;
  lumaMean: number | null;
}): SetupCheckResult => {
  const { exerciseCode, aspectRatio, lumaMean } = input;
  const window = input.frames.slice(-SETUP_WINDOW_FRAMES);
  const last = window[window.length - 1];
  if (window.length < SETUP_WINDOW_FRAMES || !last) {
    return notReady("NOT_DETECTED");
  }

  const keyJoints = keyJointsFor(exerciseCode, window);
  const visibleFrames = window.filter((frame) =>
    keyJoints.every(
      (joint) => (frame.keypoints[joint]?.[2] ?? 0) >= VISIBLE_MIN,
    ),
  ).length;
  if (visibleFrames / window.length < VISIBLE_FRAME_SHARE_MIN) {
    if (lumaMean !== null && lumaMean < DARK_LUMA) return notReady("TOO_DARK");
    return notReady(clippedEdgeOf(last, keyJoints) ?? "NOT_DETECTED");
  }

  const visible = last.keypoints.filter(([, , v]) => v >= VISIBLE_MIN);
  const xs = visible.map(([x]) => x);
  const ys = visible.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  if (minX < EDGE_MIN) return notReady("CLIPPED_LEFT");
  if (maxX > EDGE_MAX) return notReady("CLIPPED_RIGHT");
  if (minY < EDGE_MIN) return notReady("CLIPPED_TOP");
  if (maxY > EDGE_MAX) return notReady("CLIPPED_BOTTOM");

  if (Math.max(maxX - minX, maxY - minY) < SPAN_MIN) {
    return notReady("TOO_FAR");
  }

  const ratios: number[] = [];
  for (const frame of window) {
    const ratio = shoulderToTorsoRatio(frame, aspectRatio);
    if (ratio !== null) ratios.push(ratio);
  }
  if (ratios.length > 0) {
    const ratio = median(ratios);
    const isWrongAngle =
      exerciseCode === "pull_up"
        ? ratio < FRONT_SHOULDER_RATIO_MIN
        : ratio > SIDE_SHOULDER_RATIO_MAX;
    if (isWrongAngle) return notReady("WRONG_ANGLE");
  }

  return READY;
};

/** Rebases timestamps, caps the frame count and quantizes for upload. */
export const buildPoseCapturePayload = (
  frames: readonly SetupFrame[],
  meta: {
    poseModelName: string;
    poseModelVersion: string;
    aspectRatio: number;
    cameraView: "side" | "front" | "back";
    deviceModel?: string;
    appVersion?: string;
  },
): PoseCapturePayload => {
  const kept = frames.slice(0, CAPTURE_LIMITS.maxFrames);
  const first = kept[0];
  if (!first) throw new Error("No pose frames captured");

  const rebased = kept.map((frame) => ({
    timestampSec: Math.max(0, frame.timestampSec - first.timestampSec),
    keypoints: frame.keypoints,
  }));
  const lastTimestampSec = rebased[rebased.length - 1]?.timestampSec ?? 0;
  const rawFps =
    lastTimestampSec > 0 ? (kept.length - 1) / lastTimestampSec : 0;
  const fps = Math.min(
    CAPTURE_LIMITS.maxFps,
    Math.max(CAPTURE_LIMITS.minFps, rawFps),
  );

  return quantizeCapture({
    version: 1,
    poseModelName: meta.poseModelName,
    poseModelVersion: meta.poseModelVersion,
    fps,
    frameCount: rebased.length,
    durationSec: Math.min(
      CAPTURE_LIMITS.maxDurationSec,
      Math.max(lastTimestampSec, 0.001),
    ),
    cameraView: meta.cameraView,
    aspectRatio: meta.aspectRatio,
    ...(meta.deviceModel !== undefined && { deviceModel: meta.deviceModel }),
    ...(meta.appVersion !== undefined && { appVersion: meta.appVersion }),
    frames: rebased,
  });
};
