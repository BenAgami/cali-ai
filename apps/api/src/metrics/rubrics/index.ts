import type { FormAnalysisExercise } from "@repo/common";

import { dipRubric } from "./dip";
import { pullUpRubric } from "./pullUp";
import { pushUpRubric } from "./pushUp";
import { squatRubric } from "./squat";
import type { ExerciseRubric } from "./types";

export const RUBRIC_VERSION = "rubric-v0";

const RUBRICS: Record<FormAnalysisExercise, ExerciseRubric> = {
  push_up: pushUpRubric,
  dip: dipRubric,
  squat: squatRubric,
  pull_up: pullUpRubric,
};

export const getRubric = (code: FormAnalysisExercise): ExerciseRubric =>
  RUBRICS[code];
