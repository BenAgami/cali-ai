import type { WorkoutExerciseInput } from "@repo/common";

export type WorkoutExerciseDto = WorkoutExerciseInput;

export interface WorkoutPlanDto {
  name?: string;
  exercises?: WorkoutExerciseDto[];
}

export class WorkoutPlanBuilder {
  private workout: WorkoutPlanDto;

  constructor() {
    this.workout = {
      name: "Push Day",
      exercises: [{ exerciseId: 0, sets: 3, reps: 10, restSecs: 60 }],
    };
  }

  setName(name?: string): WorkoutPlanBuilder {
    this.workout.name = name;
    return this;
  }

  setExercises(exercises: WorkoutExerciseDto[]): WorkoutPlanBuilder {
    this.workout.exercises = exercises;
    return this;
  }

  build(): WorkoutPlanDto {
    return {
      ...this.workout,
      exercises: this.workout.exercises
        ? [...this.workout.exercises]
        : undefined,
    };
  }
}
