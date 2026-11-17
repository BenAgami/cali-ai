export interface RecordedSetDto {
  exerciseCode?: string;
  notes?: string;
  performedAt?: string;
}

export class RecordedSetBuilder {
  private recordedSet: RecordedSetDto;

  constructor() {
    this.recordedSet = {
      exerciseCode: "push_up",
      notes: "Felt strong and stable.",
      performedAt: new Date().toISOString(),
    };
  }

  setExerciseCode(exerciseCode?: string): RecordedSetBuilder {
    this.recordedSet.exerciseCode = exerciseCode;
    return this;
  }

  setNotes(notes?: string): RecordedSetBuilder {
    this.recordedSet.notes = notes;
    return this;
  }

  setPerformedAt(performedAt?: string): RecordedSetBuilder {
    this.recordedSet.performedAt = performedAt;
    return this;
  }

  build(): RecordedSetDto {
    return { ...this.recordedSet };
  }
}
