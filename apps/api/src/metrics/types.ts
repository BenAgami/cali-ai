import type {
  FormAnalysisExercise,
  FormBand,
  FormDimension,
  UntrackableReason,
} from "@repo/common";

export const METRICS_VERSION = "metrics-v1";

export type Point = readonly [x: number, y: number];
export type Side = "left" | "right";
export type FindingSeverity = "LOW" | "MEDIUM" | "HIGH";

export type PoseSeries = {
  exerciseCode: FormAnalysisExercise;
  cameraView: "side" | "front" | "back";
  fps: number;
  aspectRatio: number;
  timestampsSec: number[];
  /** [frame][33], isotropic, masked + gap-filled + smoothed */
  points: (Point | null)[][];
  /** [frame][33], isotropic, unmasked (wrong-view and bounds checks) */
  rawPoints: Point[][];
  /** [frame][33] */
  visibility: number[][];
  /** [frame][33] visibility >= 0.5 before gap fill */
  rawValid: boolean[][];
};

export type RepCycle = {
  repNumber: number;
  startIndex: number;
  extremeIndex: number;
  endIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  validFrameRatio: number;
};

export type SegmentationParams = {
  restLevel: "high" | "low";
  minAmplitude: number;
  minRepSec: number;
  maxRepSec: number;
  minValidFrameRatio: number;
};

export type SegmentationResult = {
  reps: RepCycle[];
  droppedRepCount: number;
  amplitude: number;
};

export type TrackabilityResult =
  | { isTrackable: true }
  | { isTrackable: false; reasons: UntrackableReason[] };

export type RepFeatures = Record<string, number>;
export type RepTag = { tag: string; severity: FindingSeverity };

export type RepMetrics = {
  repNumber: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  features: RepFeatures;
  dimensionScores: Partial<Record<FormDimension, number>>;
  tags: RepTag[];
};

export type DetectedFinding = {
  tag: string;
  dimension: FormDimension;
  severity: FindingSeverity;
  label: string;
  cue: string;
  repNumbers: number[];
  affectedFraction: number;
};

export type PositiveKind =
  | "DIMENSION_GOOD"
  | "FULL_RANGE"
  | "CONSISTENT_DEPTH"
  | "STEADY_TEMPO"
  | "COMPLETED_REPS";

export type PositiveCandidate = {
  kind: PositiveKind;
  text: string;
  repNumbers: number[];
};

export type DimensionScore = {
  score: number | null;
  band: FormBand | null;
  isAssessed: boolean;
};

export type ScoredFormMetrics = {
  outcome: "SCORED";
  exerciseCode: FormAnalysisExercise;
  cameraView: "side" | "front" | "back";
  side: Side | null;
  repCount: number;
  droppedRepCount: number;
  reps: RepMetrics[];
  dimensions: Record<FormDimension, DimensionScore>;
  overallScore: number;
  band: FormBand;
  /** <= 2, server-selected (FORM-07) */
  corrections: DetectedFinding[];
  /** >= 1 */
  positives: PositiveCandidate[];
  forbiddenTopics: string[];
  metricsVersion: string;
  rubricVersion: string;
};

export type UntrackableFormMetrics = {
  outcome: "UNTRACKABLE";
  exerciseCode: FormAnalysisExercise;
  reasons: UntrackableReason[];
  metricsVersion: string;
  rubricVersion: string;
};

export type FormMetrics = ScoredFormMetrics | UntrackableFormMetrics;
