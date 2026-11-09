import { distance, median, ramp } from "../geometry";
import {
  COMMON_FORBIDDEN_TOPICS,
  DEFAULT_SEGMENTATION,
  combine,
  definedScores,
  fatigueDropRule,
  frameAngle,
  jointPoint,
  lockoutFrames,
  leanAt,
  maxOf,
  minOf,
  repFrames,
  requireSide,
  severityAbove,
  severityBelow,
  sideIndices,
} from "./shared";
import type { ExerciseRubric } from "./types";

// 05-RUBRICS sections 3, 4, 5, 6 and 8 (dip)
export const dipRubric: ExerciseRubric = {
  exerciseCode: "dip",
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
    const elbows = frames.map((frame) =>
      frameAngle(series, frame, s.shoulder, s.elbow, s.wrist),
    );
    const hipX: number[] = [];
    const torsos: number[] = [];
    for (const frame of frames) {
      const hip = jointPoint(series, frame, s.hip);
      const shoulder = jointPoint(series, frame, s.shoulder);
      if (hip) hipX.push(hip[0]);
      if (hip && shoulder) torsos.push(distance(shoulder, hip));
    }
    const torso = median(torsos);
    return {
      minElbowDeg: minOf(elbows),
      maxElbowDeg: maxOf(
        lockoutFrames(series, rep).map((frame) =>
          frameAngle(series, frame, s.shoulder, s.elbow, s.wrist),
        ),
      ),
      trunkLeanDeg: leanAt(series, rep.extremeIndex, s.hip, s.shoulder),
      hipSwayRatio:
        hipX.length > 0 && torso > 0
          ? (Math.max(...hipX) - Math.min(...hipX)) / torso
          : Number.NaN,
      durationSec: rep.durationSec,
    };
  },
  scoreRep: (f) =>
    definedScores({
      ROM: combine([
        [ramp(f.minElbowDeg, 95, 130), 1],
        [ramp(f.maxElbowDeg, 165, 140), 1],
      ]),
      CORE: combine([
        [ramp(f.trunkLeanDeg, 30, 60), 0.6],
        [ramp(f.hipSwayRatio, 0.1, 0.35), 0.4],
      ]),
    }),
  repTags: [
    {
      tag: "DIP_SHALLOW_DEPTH",
      dimension: "ROM",
      label: "Shallow depth",
      cue: "Lower until your upper arms are about parallel to the floor.",
      evaluate: (f) => severityAbove(f.minElbowDeg, 110, 125),
    },
    {
      // Advisory only: never escalates past LOW (user decision pending, 05-RUBRICS 12).
      tag: "DIP_EXCESSIVE_DEPTH",
      dimension: "ROM",
      label: "Going very deep",
      cue: "Stop around upper arms parallel to the floor unless you've built up to deeper dips.",
      evaluate: (f) => (f.minElbowDeg < 70 ? "LOW" : null),
    },
    {
      tag: "DIP_INCOMPLETE_LOCKOUT",
      dimension: "ROM",
      label: "Arms not fully straight at the top",
      cue: "Press up until your arms are straight.",
      evaluate: (f) => severityBelow(f.maxElbowDeg, 155, null),
    },
    {
      tag: "DIP_EXCESSIVE_LEAN",
      dimension: "CORE",
      label: "Leaning far forward",
      cue: "Keep your chest more upright as you lower.",
      evaluate: (f) => severityAbove(f.trunkLeanDeg, 45, null),
    },
    {
      tag: "DIP_SWING",
      dimension: "CORE",
      label: "Swinging",
      cue: "Keep your legs still and move only up and down.",
      evaluate: (f) => severityAbove(f.hipSwayRatio, 0.25, null),
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
    fullRangeTags: ["DIP_INCOMPLETE_LOCKOUT"],
    rushedTag: null,
  },
  forbiddenTopics: [
    "shoulder shrug",
    "shoulder blades",
    "bar width",
    "injury",
    ...COMMON_FORBIDDEN_TOPICS,
  ],
};
