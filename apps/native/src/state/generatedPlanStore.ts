import type { WorkoutGenerationPreview } from "@repo/common";

let pending: WorkoutGenerationPreview | undefined;

export const setGeneratedPlan = (plan: WorkoutGenerationPreview): void => {
  pending = plan;
};

export const consumeGeneratedPlan = ():
  | WorkoutGenerationPreview
  | undefined => {
  const value = pending;
  pending = undefined;
  return value;
};
