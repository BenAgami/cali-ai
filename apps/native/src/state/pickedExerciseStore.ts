import type { ExerciseType } from "@repo/common";

export interface PickedExercise {
  exerciseId: number;
  exerciseCode: string;
  exerciseDisplayName: string;
  exerciseType: ExerciseType;
}

let pending: PickedExercise | undefined;

export const setPickedExercise = (picked: PickedExercise): void => {
  pending = picked;
};

export const consumePickedExercise = (): PickedExercise | undefined => {
  const value = pending;
  pending = undefined;
  return value;
};
