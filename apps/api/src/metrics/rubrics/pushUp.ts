import { hipOffsetRatio, mean, ramp } from "../geometry";
import {
  COMMON_FORBIDDEN_TOPICS,
  DEFAULT_SEGMENTATION,
  combine,
  definedScores,
  fatigueDropRule,
  frameAngle,
  jointPoint,
  lockoutFrames,
  maxOf,
  minOf,
  repFrames,
  requireSide,
  severityAbove,
  severityBelow,
  sideIndices,
} from "./shared";
import type { ExerciseRubric } from "./types";

// 05-RUBRICS sections 3, 4, 5, 6 and 8 (push_up)
const bodyLine = (offset: number): number =>
  offset >= 0 ? ramp(offset, 0.03, 0.15) : ramp(-offset, 0.04, 0.16);

export const pushUpRubric: ExerciseRubric = {
  exerciseCode: "push_up",
  assessed: { ROM: true, CORE: true, SYMMETRY: false },
  weights: { ROM: 0.5, CORE: 0.5, SYMMETRY: 0 },
  buildSetContext: () => ({}),
  primarySignal: (series, side) => {
    const s = sideIndices(requireSide(side));
    return {
      signal: series.points.map((_, frame) => {
        const angle = frameAngle(series, frame, s.shoulder, s.elbow, s.wrist);
        return Number.isFinite(angle) ? angle : null;
      }),
      params: { restLevel: "high", minAmplitude: 40, ...DEFAULT_SEGMENTATION },
    };
  },
  extractFeatures: (series, rep, side) => {
    const s = sideIndices(requireSide(side));
    const frames = repFrames(rep);
    const offsets = frames.map((frame) => {
      const shoulder = jointPoint(series, frame, s.shoulder);
      const hip = jointPoint(series, frame, s.hip);
      const ankle = jointPoint(series, frame, s.ankle);
      return shoulder && hip && ankle
        ? hipOffsetRatio(shoulder, hip, ankle)
        : Number.NaN;
    });
    const elbows = frames.map((frame) =>
      frameAngle(series, frame, s.shoulder, s.elbow, s.wrist),
    );
    return {
      minElbowDeg: minOf(elbows),
      maxElbowDeg: maxOf(
        lockoutFrames(series, rep).map((frame) =>
          frameAngle(series, frame, s.shoulder, s.elbow, s.wrist),
        ),
      ),
      meanHipOffset: mean(offsets.filter((v) => Number.isFinite(v))),
      durationSec: rep.durationSec,
    };
  },
  scoreRep: (f) =>
    definedScores({
      ROM: combine([
        [ramp(f.minElbowDeg, 90, 130), 1],
        [ramp(f.maxElbowDeg, 165, 140), 1],
      ]),
      CORE: combine([
        [bodyLine(f.meanHipOffset), 0.85],
        [ramp(f.durationSec, 1.5, 0.6), 0.15],
      ]),
    }),
  repTags: [
    {
      tag: "PU_SHALLOW_DEPTH",
      dimension: "ROM",
      label: "Shallow depth",
      cue: "Lower until your chest is a fist away from the floor.",
      evaluate: (f) => severityAbove(f.minElbowDeg, 100, 120),
    },
    {
      tag: "PU_INCOMPLETE_LOCKOUT",
      dimension: "ROM",
      label: "Arms not fully straight at the top",
      cue: "Press all the way up until your arms are straight.",
      evaluate: (f) => severityBelow(f.maxElbowDeg, 155, null),
    },
    {
      tag: "PU_HIP_SAG",
      dimension: "CORE",
      label: "Hips sagging",
      cue: "Squeeze your glutes and brace your abs to keep one straight line from head to heels.",
      evaluate: (f) => severityAbove(f.meanHipOffset, 0.06, 0.12),
    },
    {
      tag: "PU_HIP_PIKE",
      dimension: "CORE",
      label: "Hips piking up",
      cue: "Lower your hips so your body forms one straight line.",
      evaluate: (f) => severityAbove(-f.meanHipOffset, 0.08, null),
    },
    {
      tag: "PU_RUSHED_TEMPO",
      dimension: "CORE",
      label: "Rushed reps",
      cue: "Take about a second on the way down and control the push.",
      evaluate: (f) => (f.durationSec < 1.0 ? "LOW" : null),
    },
  ],
  setTags: [
    fatigueDropRule({
      feature: "minElbowDeg",
      worseWhen: "higher",
      threshold: 15,
    }),
  ],
  positives: {
    depthFeature: "minElbowDeg",
    depthStdMax: 8,
    fullRangeTags: ["PU_INCOMPLETE_LOCKOUT"],
    rushedTag: "PU_RUSHED_TEMPO",
  },
  forbiddenTopics: [
    "elbow flare",
    "neck position",
    "shoulder blades",
    "hand placement",
    ...COMMON_FORBIDDEN_TOPICS,
  ],
};
