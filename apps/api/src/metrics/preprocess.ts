import {
  BLAZEPOSE_KEYPOINT_COUNT,
  FORM_CAPTURE_SETUP,
  FORM_KEY_JOINTS,
  type FormAnalysisExercise,
  type PoseCapturePayload,
} from "@repo/common";

import { mean, median } from "./geometry";
import type { Point, PoseSeries, Side } from "./types";

const MIN_VISIBILITY = 0.5;
const MAX_FILL_GAP_FRAMES = 3;
const MEDIAN_RADIUS = 1;
const AVERAGE_RADIUS = 2;

export class UnsupportedCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedCaptureError";
  }
}

const CAMERA_VIEWS = ["side", "front", "back"] as const;

const fillGaps = (track: (Point | null)[]): (Point | null)[] => {
  const out = [...track];
  let i = 0;
  while (i < out.length) {
    if (out[i] !== null) {
      i += 1;
      continue;
    }
    let end = i;
    while (end < out.length && out[end] === null) end += 1;
    const before = i > 0 ? out[i - 1] : null;
    const after = end < out.length ? out[end] : null;
    const gap = end - i;
    if (before && after && gap <= MAX_FILL_GAP_FRAMES) {
      for (let k = 0; k < gap; k += 1) {
        const t = (k + 1) / (gap + 1);
        out[i + k] = [
          before[0] + (after[0] - before[0]) * t,
          before[1] + (after[1] - before[1]) * t,
        ];
      }
    }
    i = end;
  }
  return out;
};

/** Windowed statistic over non-null neighbours; a null centre stays null. */
const windowed = (
  track: (Point | null)[],
  radius: number,
  reducer: (values: number[]) => number,
): (Point | null)[] =>
  track.map((centre, index) => {
    if (centre === null) return null;
    const xs: number[] = [];
    const ys: number[] = [];
    for (
      let k = Math.max(0, index - radius);
      k <= Math.min(track.length - 1, index + radius);
      k += 1
    ) {
      const p = track[k];
      if (p) {
        xs.push(p[0]);
        ys.push(p[1]);
      }
    }
    return [reducer(xs), reducer(ys)] as const;
  });

const smooth = (track: (Point | null)[]): (Point | null)[] =>
  windowed(windowed(track, MEDIAN_RADIUS, median), AVERAGE_RADIUS, mean);

export const toPoseSeries = (
  payload: PoseCapturePayload,
  exerciseCode: FormAnalysisExercise,
): PoseSeries => {
  const setup = FORM_CAPTURE_SETUP[exerciseCode];
  if (payload.frames[0]?.keypoints.length !== BLAZEPOSE_KEYPOINT_COUNT) {
    throw new UnsupportedCaptureError(
      `Expected ${BLAZEPOSE_KEYPOINT_COUNT} keypoints per frame`,
    );
  }

  const aspectRatio =
    payload.aspectRatio ??
    (setup.orientation === "landscape" ? 16 / 9 : 9 / 16);
  const cameraView =
    CAMERA_VIEWS.find((view) => view === payload.cameraView) ??
    setup.cameraView;

  const rawPoints: Point[][] = payload.frames.map((frame) =>
    frame.keypoints.map(([x, y]): Point => [x * aspectRatio, y]),
  );
  const visibility = payload.frames.map((frame) =>
    frame.keypoints.map(([, , v]) => v),
  );
  const rawValid = visibility.map((row) => row.map((v) => v >= MIN_VISIBILITY));

  const points: (Point | null)[][] = payload.frames.map(() =>
    new Array<Point | null>(BLAZEPOSE_KEYPOINT_COUNT).fill(null),
  );
  for (let joint = 0; joint < BLAZEPOSE_KEYPOINT_COUNT; joint += 1) {
    const masked = rawPoints.map((row, f) =>
      rawValid[f][joint] ? row[joint] : null,
    );
    const processed = smooth(fillGaps(masked));
    processed.forEach((p, f) => {
      points[f][joint] = p;
    });
  }

  return {
    exerciseCode,
    cameraView,
    fps: payload.fps,
    aspectRatio,
    timestampsSec: payload.frames.map((frame) => frame.timestampSec),
    points,
    rawPoints,
    visibility,
    rawValid,
  };
};

export const chooseNearSide = (series: PoseSeries): Side => {
  const joints = FORM_KEY_JOINTS[series.exerciseCode];
  const sideVisibility = (indices: readonly number[]): number =>
    mean(series.visibility.flatMap((row) => indices.map((i) => row[i])));
  return sideVisibility(joints.right) > sideVisibility(joints.left)
    ? "right"
    : "left";
};

export const jointTrack = (
  series: PoseSeries,
  index: number,
): (Point | null)[] => series.points.map((row) => row[index] ?? null);
