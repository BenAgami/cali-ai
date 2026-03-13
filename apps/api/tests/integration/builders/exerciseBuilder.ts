import { randomUUID } from "crypto";

import { ExerciseType } from "@repo/db";

export interface ExerciseDto {
  code: string;
  displayName: string;
  exerciseType: ExerciseType;
  isActive?: boolean;
  description?: string | null;
}

export class ExerciseBuilder {
  private exercise: ExerciseDto;

  constructor() {
    const suffix = randomUUID().split("-")[0];
    this.exercise = {
      code: `push_up_${suffix}`,
      displayName: `Push Up ${suffix}`,
      exerciseType: ExerciseType.DYNAMIC,
      isActive: true,
      description: "Upper body strength exercise",
    };
  }

  setCode(code: string): ExerciseBuilder {
    this.exercise.code = code;
    return this;
  }

  setDisplayName(displayName: string): ExerciseBuilder {
    this.exercise.displayName = displayName;
    return this;
  }

  setExerciseType(exerciseType: ExerciseType): ExerciseBuilder {
    this.exercise.exerciseType = exerciseType;
    return this;
  }

  setIsActive(isActive: boolean): ExerciseBuilder {
    this.exercise.isActive = isActive;
    return this;
  }

  setDescription(description: string | null): ExerciseBuilder {
    this.exercise.description = description;
    return this;
  }

  build(): ExerciseDto {
    return { ...this.exercise };
  }
}
