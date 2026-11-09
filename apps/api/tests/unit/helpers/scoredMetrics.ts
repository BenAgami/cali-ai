import type { ScoredFormMetrics } from "../../../src/metrics/types";

export const makeScoredMetrics = (
  overrides: Partial<ScoredFormMetrics> = {},
): ScoredFormMetrics => ({
  outcome: "SCORED",
  exerciseCode: "push_up",
  cameraView: "side",
  side: "left",
  repCount: 5,
  droppedRepCount: 0,
  reps: [1, 2, 3, 4, 5].map((repNumber) => ({
    repNumber,
    startSec: repNumber,
    endSec: repNumber + 1,
    durationSec: 1.234,
    features: { hipSag: 0.12345 },
    dimensionScores: { CORE: 55 },
    tags: repNumber >= 3 ? [{ tag: "PU_HIP_SAG", severity: "MEDIUM" }] : [],
  })),
  dimensions: {
    ROM: { score: 80, band: "GOOD", isAssessed: true },
    CORE: { score: 50, band: "NEEDS_WORK", isAssessed: true },
    SYMMETRY: { score: null, band: null, isAssessed: false },
  },
  overallScore: 61,
  band: "FAIR",
  corrections: [
    {
      tag: "PU_HIP_SAG",
      dimension: "CORE",
      severity: "MEDIUM",
      label: "Hips sagging",
      cue: "Squeeze your glutes to keep a straight line",
      repNumbers: [3, 4, 5],
      affectedFraction: 0.6,
    },
    {
      tag: "PU_SHALLOW_DEPTH",
      dimension: "ROM",
      severity: "LOW",
      label: "Shallow depth",
      cue: "Lower until your chest nearly touches the floor",
      repNumbers: [4, 5],
      affectedFraction: 0.4,
    },
  ],
  positives: [
    { kind: "COMPLETED_REPS", text: "You completed 5 reps", repNumbers: [] },
    {
      kind: "STEADY_TEMPO",
      text: "Your tempo stayed steady",
      repNumbers: [1, 2],
    },
  ],
  forbiddenTopics: ["shoulder impingement", "wrist pain"],
  metricsVersion: "metrics-v1",
  rubricVersion: "rubric-v0",
  ...overrides,
});
