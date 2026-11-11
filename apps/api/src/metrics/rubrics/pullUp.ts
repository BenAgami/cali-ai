import { BLAZEPOSE } from "@repo/common";

import { distance, mean, median, ramp } from "../geometry";
import type { Point, PoseSeries } from "../types";
import {
  COMMON_FORBIDDEN_TOPICS,
  DEFAULT_SEGMENTATION,
  combine,
  definedScores,
  fatigueDropRule,
  finiteValues,
  frameAngle,
  jointPoint,
  lockoutFrames,
  maxOf,
  meanOfAvailable,
  repFrames,
  severityAbove,
  severityBelow,
} from "./shared";
import type { ExerciseRubric } from "./types";

// 05-RUBRICS sections 3, 4, 5, 6 and 8 (pull_up)
const {
  MOUTH_LEFT,
  MOUTH_RIGHT,
  LEFT_SHOULDER,
  RIGHT_SHOULDER,
  LEFT_ELBOW,
  RIGHT_ELBOW,
  LEFT_WRIST,
  RIGHT_WRIST,
  LEFT_HIP,
  RIGHT_HIP,
} = BLAZEPOSE;

const meanY = (points: Array<Point | null>): number => {
  const present = points.filter((p): p is Point => p !== null);
  return present.length === 0 ? Number.NaN : mean(present.map((p) => p[1]));
};

const mouthY = (series: PoseSeries, frame: number): number =>
  meanY([
    jointPoint(series, frame, MOUTH_LEFT),
    jointPoint(series, frame, MOUTH_RIGHT),
  ]);

const frameIndices = (series: PoseSeries): number[] =>
  series.points.map((_, frame) => frame);

/** Mean of the left and right elbow angles; NaN unless both are available. */
const meanElbowAngle = (series: PoseSeries, frame: number): number => {
  const left = frameAngle(series, frame, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST);
  const right = frameAngle(
    series,
    frame,
    RIGHT_SHOULDER,
    RIGHT_ELBOW,
    RIGHT_WRIST,
  );
  return (left + right) / 2;
};

const elbowDiff = (series: PoseSeries, frame: number): number =>
  Math.abs(
    frameAngle(series, frame, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST) -
      frameAngle(series, frame, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST),
  );

const shoulderTilt = (series: PoseSeries, frame: number): number => {
  const left = jointPoint(series, frame, LEFT_SHOULDER);
  const right = jointPoint(series, frame, RIGHT_SHOULDER);
  if (!left || !right) return Number.NaN;
  return (
    (Math.atan2(Math.abs(left[1] - right[1]), Math.abs(left[0] - right[0])) *
      180) /
    Math.PI
  );
};

export const pullUpRubric: ExerciseRubric = {
  exerciseCode: "pull_up",
  assessed: { ROM: true, CORE: true, SYMMETRY: true },
  weights: { ROM: 0.5, CORE: 0.1, SYMMETRY: 0.4 },
  buildSetContext: (series) => {
    const frames = frameIndices(series);
    const barY = median(
      finiteValues(
        frames.map((frame) =>
          meanY([
            jointPoint(series, frame, LEFT_WRIST),
            jointPoint(series, frame, RIGHT_WRIST),
          ]),
        ),
      ),
    );
    const torsos = frames.flatMap((frame) => {
      const lengths = [
        [LEFT_SHOULDER, LEFT_HIP],
        [RIGHT_SHOULDER, RIGHT_HIP],
      ].flatMap(([shoulder, hip]) => {
        const a = jointPoint(series, frame, shoulder);
        const b = jointPoint(series, frame, hip);
        return a && b ? [distance(a, b)] : [];
      });
      return lengths.length === 2 ? [mean(lengths)] : [];
    });
    return { barY, torsoLength: median(torsos) };
  },
  primarySignal: (series, _side, context) => ({
    signal: frameIndices(series).map((frame) => {
      const y = mouthY(series, frame);
      const clearance = (context.barY - y) / context.torsoLength;
      return Number.isFinite(clearance) ? clearance : null;
    }),
    params: { restLevel: "low", minAmplitude: 0.5, ...DEFAULT_SEGMENTATION },
  }),
  extractFeatures: (series, rep, _side, context) => {
    const frames = repFrames(rep);
    const hipX = frames.flatMap((frame) => {
      const left = jointPoint(series, frame, LEFT_HIP);
      const right = jointPoint(series, frame, RIGHT_HIP);
      return left && right ? [(left[0] + right[0]) / 2] : [];
    });
    return {
      mouthBelowBar:
        (mouthY(series, rep.extremeIndex) - context.barY) / context.torsoLength,
      maxElbowDeg: maxOf(
        lockoutFrames(series, rep).map((frame) =>
          meanElbowAngle(series, frame),
        ),
      ),
      meanElbowDiffDeg: meanOfAvailable(
        frames.map((frame) => elbowDiff(series, frame)),
      ),
      maxShoulderTiltDeg: maxOf(
        frames.map((frame) => shoulderTilt(series, frame)),
      ),
      hipSwayRatio:
        hipX.length > 0
          ? (Math.max(...hipX) - Math.min(...hipX)) / context.torsoLength
          : Number.NaN,
      durationSec: rep.durationSec,
    };
  },
  scoreRep: (f) =>
    definedScores({
      ROM: combine([
        [ramp(f.mouthBelowBar, -0.05, 0.25), 1],
        [ramp(f.maxElbowDeg, 165, 140), 1],
      ]),
      CORE: combine([
        [ramp(f.hipSwayRatio, 0.1, 0.4), 0.7],
        [ramp(f.durationSec, 1.8, 0.8), 0.3],
      ]),
      SYMMETRY: combine([
        [ramp(f.meanElbowDiffDeg, 5, 25), 1],
        [ramp(f.maxShoulderTiltDeg, 4, 15), 1],
      ]),
    }),
  repTags: [
    {
      tag: "PL_CHIN_NOT_OVER_BAR",
      dimension: "ROM",
      label: "Chin not clearing the bar",
      cue: "Pull until your chin passes over the bar.",
      evaluate: (f) => severityAbove(f.mouthBelowBar, 0.03, 0.15),
    },
    {
      tag: "PL_NO_FULL_HANG",
      dimension: "ROM",
      label: "Not lowering all the way",
      cue: "Lower until your arms are straight before the next rep.",
      evaluate: (f) => severityBelow(f.maxElbowDeg, 155, null),
    },
    {
      tag: "PL_ASYM_PULL",
      dimension: "SYMMETRY",
      label: "Pulling unevenly",
      cue: "Pull with both arms equally and keep your shoulders level.",
      evaluate: (f) => {
        if (f.meanElbowDiffDeg > 20 || f.maxShoulderTiltDeg > 14) return "HIGH";
        if (f.meanElbowDiffDeg > 12 || f.maxShoulderTiltDeg > 8)
          return "MEDIUM";
        return null;
      },
    },
    {
      tag: "PL_RUSHED_TEMPO",
      dimension: "CORE",
      label: "Rushed reps",
      cue: "Lower yourself slowly instead of dropping.",
      evaluate: (f) => (f.durationSec < 1.2 ? "LOW" : null),
    },
  ],
  setTags: [
    fatigueDropRule({
      feature: "mouthBelowBar",
      worseWhen: "higher",
      threshold: 0.08,
    }),
  ],
  positives: {
    depthFeature: "mouthBelowBar",
    depthStdMax: 0.05,
    fullRangeTags: ["PL_NO_FULL_HANG"],
    rushedTag: "PL_RUSHED_TEMPO",
  },
  forbiddenTopics: [
    "kipping",
    "body swing front-to-back",
    "shoulder blades",
    "grip width",
    ...COMMON_FORBIDDEN_TOPICS,
  ],
};
