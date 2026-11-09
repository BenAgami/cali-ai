import {
  bandFromScore,
  FORM_DIMENSIONS,
  type FormDimension,
} from "@repo/common";

import { mean } from "./geometry";
import type { ExerciseRubric } from "./rubrics/types";
import type { DimensionScore, RepMetrics } from "./types";

// 05-RUBRICS section 6: set score = round(0.85 x mean + 0.15 x worst rep)
const MEAN_WEIGHT = 0.85;
const MIN_WEIGHT = 0.15;

export const aggregateDimension = (repScores: number[]): number | null => {
  const valid = repScores.filter((score) => Number.isFinite(score));
  if (valid.length === 0) return null;
  return Math.round(
    MEAN_WEIGHT * mean(valid) + MIN_WEIGHT * Math.min(...valid),
  );
};

export const buildDimensions = (
  reps: RepMetrics[],
  rubric: ExerciseRubric,
): Record<FormDimension, DimensionScore> => {
  const result = {} as Record<FormDimension, DimensionScore>;
  for (const dimension of FORM_DIMENSIONS) {
    const score = rubric.assessed[dimension]
      ? aggregateDimension(
          reps.flatMap((rep) => rep.dimensionScores[dimension] ?? []),
        )
      : null;
    result[dimension] =
      score === null
        ? { score: null, band: null, isAssessed: false }
        : { score, band: bandFromScore(score), isAssessed: true };
  }
  return result;
};

/** Weighted mean over assessed dimensions with a score, weights renormalised. */
export const computeOverall = (
  dimensions: Record<FormDimension, DimensionScore>,
  weights: Record<FormDimension, number>,
): number => {
  let weighted = 0;
  let totalWeight = 0;
  for (const dimension of FORM_DIMENSIONS) {
    const { isAssessed, score } = dimensions[dimension];
    if (!isAssessed || score === null) continue;
    weighted += weights[dimension] * score;
    totalWeight += weights[dimension];
  }
  return totalWeight === 0 ? 0 : Math.round(weighted / totalWeight);
};
