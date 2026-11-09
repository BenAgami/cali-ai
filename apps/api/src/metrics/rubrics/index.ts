import type { FormAnalysisExercise } from "@repo/common";

import { dipRubric } from "./dip";
import { pushUpRubric } from "./pushUp";
import type { ExerciseRubric } from "./types";

/** @public Stamped on every FormMetrics (05-14). */
export const RUBRIC_VERSION = "rubric-v0";

const RUBRICS: Partial<Record<FormAnalysisExercise, ExerciseRubric>> = {
  push_up: pushUpRubric,
  dip: dipRubric,
};

/** @public Consumed by 05-14 computeFormMetrics. */
export const getRubric = (code: FormAnalysisExercise): ExerciseRubric => {
  const rubric = RUBRICS[code];
  if (!rubric) throw new Error(`No rubric for ${code}`);
  return rubric;
};
