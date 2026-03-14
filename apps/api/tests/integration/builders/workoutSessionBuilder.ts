export type WorkoutSessionVideoMetaDto = {
  durationSec?: number;
  fps?: number;
  width?: number;
  height?: number;
  sizeBytes?: number;
};

export interface WorkoutSessionDto {
  exerciseCode?: string;
  notes?: string;
  performedAt?: string;
  videoMeta?: WorkoutSessionVideoMetaDto;
}

export class WorkoutSessionBuilder {
  private session: WorkoutSessionDto;

  constructor() {
    this.session = {
      exerciseCode: "push_up",
      notes: "Felt strong and stable.",
      performedAt: new Date().toISOString(),
      videoMeta: {
        durationSec: 12.5,
        fps: 30,
        width: 720,
        height: 1280,
        sizeBytes: 5_000_000,
      },
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

  setVideoMeta(videoMeta?: WorkoutSessionVideoMetaDto): WorkoutSessionBuilder {
    this.session.videoMeta = videoMeta;
    return this;
  }

  build(): WorkoutSessionDto {
    return { ...this.session };
  }
}
