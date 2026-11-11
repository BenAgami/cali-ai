import { BLAZEPOSE, type FormDimension } from "@repo/common";

import { angleAt, angleFromVertical, mean } from "../geometry";
import type {
  FindingSeverity,
  Point,
  PoseSeries,
  RepCycle,
  SegmentationParams,
  Side,
} from "../types";
import type { SetTagRule } from "./types";

export const DEFAULT_SEGMENTATION: Pick<
  SegmentationParams,
  "minRepSec" | "maxRepSec" | "minValidFrameRatio"
> = { minRepSec: 0.8, maxRepSec: 15, minValidFrameRatio: 0.6 };

export const COMMON_FORBIDDEN_TOPICS = [
  "injury",
  "pain",
  "medical terms",
  "height",
  "weight",
  "body composition",
];

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

/** HIGH above `high`, MEDIUM above `medium`; NaN never triggers. */
export const severityAbove = (
  value: number,
  medium: number,
  high: number | null,
): FindingSeverity | null => {
  if (high !== null && value > high) return "HIGH";
  if (value > medium) return "MEDIUM";
  return null;
};

/** HIGH below `high`, MEDIUM below `medium`; NaN never triggers. */
export const severityBelow = (
  value: number,
  medium: number,
  high: number | null,
): FindingSeverity | null => {
  if (high !== null && value < high) return "HIGH";
  if (value < medium) return "MEDIUM";
  return null;
};

export const maxSeverity = (
  a: FindingSeverity | null,
  b: FindingSeverity | null,
): FindingSeverity | null => {
  if (a === null) return b;
  if (b === null) return a;
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
};

/** Shared set-level FATIGUE_DROP rule: needs >= 4 reps, compares first 2 vs last 2. */
export const fatigueDropRule = (options: {
  feature: string;
  worseWhen: "higher" | "lower";
  threshold: number;
}): SetTagRule => ({
  tag: "FATIGUE_DROP",
  dimension: "ROM",
  label: "Form faded in the last reps",
  cue: "End the set when you can't keep the same range, or rest a little longer.",
  evaluate: (reps) => {
    if (reps.length < 4) return null;
    const first = mean(
      reps.slice(0, 2).map((r) => r.features[options.feature]),
    );
    const last = mean(reps.slice(-2).map((r) => r.features[options.feature]));
    const drop = options.worseWhen === "higher" ? last - first : first - last;
    if (!(drop > options.threshold)) return null;
    return {
      severity: "MEDIUM",
      repNumbers: reps.slice(-2).map((r) => r.repNumber),
    };
  },
});

export const jointPoint = (
  series: PoseSeries,
  frame: number,
  index: number,
): Point | null => series.points[frame][index] ?? null;

export type SideIndices = {
  shoulder: number;
  elbow: number;
  wrist: number;
  hip: number;
  knee: number;
  ankle: number;
  heel: number;
  footIndex: number;
};

export const sideIndices = (side: Side): SideIndices =>
  side === "left"
    ? {
        shoulder: BLAZEPOSE.LEFT_SHOULDER,
        elbow: BLAZEPOSE.LEFT_ELBOW,
        wrist: BLAZEPOSE.LEFT_WRIST,
        hip: BLAZEPOSE.LEFT_HIP,
        knee: BLAZEPOSE.LEFT_KNEE,
        ankle: BLAZEPOSE.LEFT_ANKLE,
        heel: BLAZEPOSE.LEFT_HEEL,
        footIndex: BLAZEPOSE.LEFT_FOOT_INDEX,
      }
    : {
        shoulder: BLAZEPOSE.RIGHT_SHOULDER,
        elbow: BLAZEPOSE.RIGHT_ELBOW,
        wrist: BLAZEPOSE.RIGHT_WRIST,
        hip: BLAZEPOSE.RIGHT_HIP,
        knee: BLAZEPOSE.RIGHT_KNEE,
        ankle: BLAZEPOSE.RIGHT_ANKLE,
        heel: BLAZEPOSE.RIGHT_HEEL,
        footIndex: BLAZEPOSE.RIGHT_FOOT_INDEX,
      };

/** Side-on rubrics need the near side; a null side is a caller bug. */
export const requireSide = (side: Side | null): Side => {
  if (side === null) throw new Error("A near side is required for this rubric");
  return side;
};

/** Angle at b for one frame; NaN when any joint is missing. */
export const frameAngle = (
  series: PoseSeries,
  frame: number,
  a: number,
  b: number,
  c: number,
): number => {
  const pa = jointPoint(series, frame, a);
  const pb = jointPoint(series, frame, b);
  const pc = jointPoint(series, frame, c);
  return pa && pb && pc ? angleAt(pa, pb, pc) : Number.NaN;
};

export const repFrames = (rep: RepCycle): number[] =>
  Array.from(
    { length: rep.endIndex - rep.startIndex + 1 },
    (_, offset) => rep.startIndex + offset,
  );

/**
 * Rep frames plus half a second of the surrounding rest. Segmentation cuts a
 * rep where the signal re-crosses the rest threshold, so lockout / full-hang
 * extremes sit just outside [startIndex, endIndex].
 */
export const lockoutFrames = (series: PoseSeries, rep: RepCycle): number[] => {
  const pad = Math.ceil(0.5 * series.fps);
  const first = Math.max(0, rep.startIndex - pad);
  const last = Math.min(series.points.length - 1, rep.endIndex + pad);
  return Array.from(
    { length: last - first + 1 },
    (_, offset) => first + offset,
  );
};

export const finiteValues = (values: readonly number[]): number[] =>
  values.filter((v) => Number.isFinite(v));

export const minOf = (values: readonly number[]): number => {
  const finite = finiteValues(values);
  return finite.length === 0 ? Number.NaN : Math.min(...finite);
};

export const maxOf = (values: readonly number[]): number => {
  const finite = finiteValues(values);
  return finite.length === 0 ? Number.NaN : Math.max(...finite);
};

/** Mean over available (finite) values; NaN when none. */
export const meanOfAvailable = (values: readonly number[]): number =>
  mean(finiteValues(values));

/** Weighted mean over available parts, weights renormalised; NaN when none. */
export const combine = (
  parts: Array<[value: number, weight: number]>,
): number => {
  const available = parts.filter(([value]) => Number.isFinite(value));
  const total = available.reduce((sum, [, weight]) => sum + weight, 0);
  if (total === 0) return Number.NaN;
  return available.reduce((sum, [v, w]) => sum + v * w, 0) / total;
};

/** Drop NaN dimension scores so the orchestrator never sees them. */
export const definedScores = (
  scores: Partial<Record<FormDimension, number>>,
): Partial<Record<FormDimension, number>> => {
  const result: Partial<Record<FormDimension, number>> = {};
  for (const [dimension, score] of Object.entries(scores) as Array<
    [FormDimension, number]
  >) {
    if (Number.isFinite(score)) result[dimension] = score;
  }
  return result;
};

/** Degrees from vertical of the lower -> upper segment in one frame; NaN when missing. */
export const leanAt = (
  series: PoseSeries,
  frame: number,
  lowerIndex: number,
  upperIndex: number,
): number => {
  const lower = jointPoint(series, frame, lowerIndex);
  const upper = jointPoint(series, frame, upperIndex);
  return lower && upper ? angleFromVertical(lower, upper) : Number.NaN;
};
