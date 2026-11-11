import { distance, median, mean, ramp } from "../geometry";
import type { PoseSeries, Side } from "../types";
import {
  COMMON_FORBIDDEN_TOPICS,
  DEFAULT_SEGMENTATION,
  combine,
  definedScores,
  fatigueDropRule,
  frameAngle,
  jointPoint,
  leanAt,
  lockoutFrames,
  maxOf,
  maxSeverity,
  minOf,
  repFrames,
  requireSide,
  severityAbove,
  severityBelow,
  sideIndices,
} from "./shared";
import type { ExerciseRubric } from "./types";

// 05-RUBRICS sections 3, 4, 5, 6 and 8 (squat)
const MIN_KNEE_VISIBILITY = 0.6;
const BASELINE_SEC = 1;

/** Angle of the heel -> foot-index line from horizontal; NaN when missing. */
const heelLineDeg = (series: PoseSeries, frame: number, side: Side): number => {
  const s = sideIndices(side);
  const heel = jointPoint(series, frame, s.heel);
  const foot = jointPoint(series, frame, s.footIndex);
  if (!heel || !foot) return Number.NaN;
  return (
    (Math.atan2(foot[1] - heel[1], Math.abs(foot[0] - heel[0])) * 180) / Math.PI
  );
};

const isKneeReliable = (series: PoseSeries, side: Side): boolean =>
  mean(series.visibility.map((row) => row[sideIndices(side).knee])) >=
  MIN_KNEE_VISIBILITY;

export const squatRubric: ExerciseRubric = {
  exerciseCode: "squat",
  assessed: { ROM: true, CORE: true, SYMMETRY: false },
  weights: { ROM: 0.5, CORE: 0.5, SYMMETRY: 0 },
  buildSetContext: (series, side) => {
    const s = sideIndices(requireSide(side));
    const start = series.timestampsSec[0] ?? 0;
    const baseline = series.timestampsSec.flatMap((t, frame) =>
      t - start < BASELINE_SEC ? [heelLineDeg(series, frame, side!)] : [],
    );
    // Unmasked points: a low-visibility knee must still yield a thigh length.
    const thighs = series.rawPoints.map((row) =>
      distance(row[s.hip], row[s.knee]),
    );
    return {
      heelBaselineDeg: median(baseline.filter((v) => Number.isFinite(v))),
      thighLength: median(thighs),
    };
  },
  primarySignal: (series, side, context) => {
    const s = sideIndices(requireSide(side));
    if (isKneeReliable(series, side!)) {
      return {
        signal: series.points.map((_, frame) => {
          const angle = frameAngle(series, frame, s.hip, s.knee, s.ankle);
          return Number.isFinite(angle) ? angle : null;
        }),
        params: {
          restLevel: "high",
          minAmplitude: 30,
          ...DEFAULT_SEGMENTATION,
        },
      };
    }
    const thigh = context.thighLength;
    return {
      signal: series.points.map((_, frame) => {
        const hip = jointPoint(series, frame, s.hip);
        return hip && thigh > 0 ? -hip[1] / thigh : null;
      }),
      params: { restLevel: "high", minAmplitude: 0.5, ...DEFAULT_SEGMENTATION },
    };
  },
  extractFeatures: (series, rep, side, context) => {
    const s = sideIndices(requireSide(side));
    const knees = repFrames(rep).map((frame) =>
      frameAngle(series, frame, s.hip, s.knee, s.ankle),
    );
    const hip = jointPoint(series, rep.extremeIndex, s.hip);
    const knee = jointPoint(series, rep.extremeIndex, s.knee);
    const thigh = context.thighLength;
    return {
      minKneeDeg: minOf(knees),
      maxKneeDeg: maxOf(
        lockoutFrames(series, rep).map((frame) =>
          frameAngle(series, frame, s.hip, s.knee, s.ankle),
        ),
      ),
      hipBelowKnee:
        hip && knee && thigh > 0 ? (hip[1] - knee[1]) / thigh : Number.NaN,
      trunkLeanDeg: leanAt(series, rep.extremeIndex, s.hip, s.shoulder),
      shinLeanDeg: leanAt(series, rep.extremeIndex, s.ankle, s.knee),
      heelRiseDeg: Math.abs(
        heelLineDeg(series, rep.extremeIndex, side!) - context.heelBaselineDeg,
      ),
      durationSec: rep.durationSec,
    };
  },
  scoreRep: (f) =>
    definedScores({
      ROM: combine([
        [ramp(f.hipBelowKnee, 0.0, -0.15), 1],
        [ramp(f.maxKneeDeg, 170, 150), 1],
      ]),
      CORE: combine([
        [ramp(f.trunkLeanDeg - f.shinLeanDeg, 15, 40), 0.7],
        [ramp(f.heelRiseDeg, 3, 15), 0.3],
      ]),
    }),
  repTags: [
    {
      tag: "SQ_SHALLOW_DEPTH",
      dimension: "ROM",
      label: "Shallow depth",
      cue: "Sit down until your hips are level with your knees.",
      evaluate: (f) =>
        maxSeverity(
          severityBelow(f.hipBelowKnee, -0.05, -0.2),
          severityAbove(f.minKneeDeg, 110, null),
        ),
    },
    {
      tag: "SQ_EXCESSIVE_TRUNK_LEAN",
      dimension: "CORE",
      label: "Leaning forward a lot",
      cue: "Keep your chest up and sit your hips straight down.",
      evaluate: (f) =>
        f.trunkLeanDeg - f.shinLeanDeg > 25 || f.trunkLeanDeg > 60
          ? "MEDIUM"
          : null,
    },
    {
      tag: "SQ_HEEL_RISE",
      dimension: "CORE",
      label: "Heels lifting",
      cue: "Keep your whole foot on the floor and push through your heels.",
      evaluate: (f) => severityAbove(f.heelRiseDeg, 10, null),
    },
    {
      tag: "SQ_INCOMPLETE_STAND",
      dimension: "ROM",
      label: "Not standing all the way up",
      cue: "Stand tall at the top of every rep.",
      evaluate: (f) => (f.maxKneeDeg < 160 ? "LOW" : null),
    },
    {
      tag: "SQ_RUSHED_TEMPO",
      dimension: "CORE",
      label: "Bouncing through reps",
      cue: "Control the way down and pause briefly at the bottom.",
      evaluate: (f) => (f.durationSec < 1.0 ? "LOW" : null),
    },
  ],
  setTags: [
    fatigueDropRule({
      feature: "hipBelowKnee",
      worseWhen: "lower",
      threshold: 0.1,
    }),
  ],
  positives: {
    depthFeature: "hipBelowKnee",
    depthStdMax: 0.05,
    fullRangeTags: ["SQ_INCOMPLETE_STAND"],
    rushedTag: "SQ_RUSHED_TEMPO",
  },
  forbiddenTopics: [
    "knees caving in",
    "lower-back rounding",
    "foot angle",
    "knees past toes",
    ...COMMON_FORBIDDEN_TOPICS,
  ],
};
