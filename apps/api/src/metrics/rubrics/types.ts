import type { FormAnalysisExercise, FormDimension } from "@repo/common";

import type {
  FindingSeverity,
  PoseSeries,
  RepCycle,
  RepFeatures,
  RepMetrics,
  SegmentationParams,
  Side,
} from "../types";

/** Per-set constants measured once (baselines, bar height, limb lengths). */
export type SetContext = Record<string, number>;

export type TagRule = {
  tag: string;
  dimension: FormDimension;
  label: string;
  cue: string;
  evaluate: (features: RepFeatures) => FindingSeverity | null;
};

export type SetTagRule = {
  tag: string;
  dimension: FormDimension;
  label: string;
  cue: string;
  evaluate: (
    reps: RepMetrics[],
  ) => { severity: FindingSeverity; repNumbers: number[] } | null;
};

/** Exercise-specific part of 05-RUBRICS; 05-14 orchestrates it generically. */
export type ExerciseRubric = {
  exerciseCode: FormAnalysisExercise;
  assessed: Record<FormDimension, boolean>;
  weights: Record<FormDimension, number>;
  buildSetContext: (series: PoseSeries, side: Side | null) => SetContext;
  primarySignal: (
    series: PoseSeries,
    side: Side | null,
    context: SetContext,
  ) => { signal: (number | null)[]; params: SegmentationParams };
  extractFeatures: (
    series: PoseSeries,
    rep: RepCycle,
    side: Side | null,
    context: SetContext,
  ) => RepFeatures;
  scoreRep: (features: RepFeatures) => Partial<Record<FormDimension, number>>;
  repTags: TagRule[];
  setTags: SetTagRule[];
  positives: {
    depthFeature: string;
    depthStdMax: number;
    fullRangeTags: string[];
    rushedTag: string | null;
  };
  forbiddenTopics: string[];
};
