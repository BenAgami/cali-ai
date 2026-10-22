export interface WorkoutSessionDto {
  exerciseCode?: string;
  notes?: string;
  performedAt?: string;
}

export class WorkoutSessionBuilder {
  private session: WorkoutSessionDto;

  constructor() {
    this.session = {
      exerciseCode: "push_up",
      notes: "Felt strong and stable.",
      performedAt: new Date().toISOString(),
    };
  }

  setExerciseCode(exerciseCode?: string): WorkoutSessionBuilder {
    this.session.exerciseCode = exerciseCode;
    return this;
  }

  setNotes(notes?: string): WorkoutSessionBuilder {
    this.session.notes = notes;
    return this;
  }

  setPerformedAt(performedAt?: string): WorkoutSessionBuilder {
    this.session.performedAt = performedAt;
    return this;
  }

  build(): WorkoutSessionDto {
    return { ...this.session };
  }
}
