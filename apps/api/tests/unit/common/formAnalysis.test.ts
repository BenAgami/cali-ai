import {
  bandFromScore,
  buildUntrackableAdvice,
  FORM_VIEW_HINTS,
  formAnalysisResponseSchema,
  isFormAnalysisExercise,
  recordedSetSchema,
  UNTRACKABLE_ADVICE,
} from "@repo/common";

const base = {
  sessionId: 1,
  workoutId: 2,
  setNumber: 1,
  exerciseCode: "push_up",
  exerciseDisplayName: "Push-up",
  analyzedAt: "2026-11-08T12:00:00.000Z",
};

const scored = {
  ...base,
  outcome: "SCORED" as const,
  band: "GOOD" as const,
  repCount: 8,
  summary: "Solid set.",
  dimensions: [
    { dimension: "ROM" as const, band: "GOOD" as const, isAssessed: true },
    { dimension: "CORE" as const, band: "FAIR" as const, isAssessed: true },
    { dimension: "SYMMETRY" as const, band: null, isAssessed: false },
  ],
  positives: [{ text: "Good depth", repNumbers: [1, 2] }],
  corrections: [
    {
      code: "HIPS_SAG",
      title: "Hips sag",
      cue: "Squeeze glutes",
      detail: "Hips dropped",
      severity: "MEDIUM" as const,
      repNumbers: [3],
    },
  ],
};

describe("bandFromScore", () => {
  it.for([
    [100, "EXCELLENT"],
    [90, "EXCELLENT"],
    [89, "GOOD"],
    [89.5, "EXCELLENT"],
    [75, "GOOD"],
    [74, "FAIR"],
    [60, "FAIR"],
    [59, "NEEDS_WORK"],
    [40, "NEEDS_WORK"],
    [39, "POOR"],
    [0, "POOR"],
    [-5, "POOR"],
    [120, "EXCELLENT"],
  ] as const)("maps %s to %s", ([score, band]) => {
    expect(bandFromScore(score)).toBe(band);
  });
});

describe("isFormAnalysisExercise", () => {
  it("accepts supported codes only, case-sensitively", () => {
    expect(isFormAnalysisExercise("push_up")).toBe(true);
    expect(isFormAnalysisExercise("plank")).toBe(false);
    expect(isFormAnalysisExercise("Push_Up")).toBe(false);
  });
});

describe("buildUntrackableAdvice", () => {
  it("appends the view hint after the reason advice", () => {
    expect(buildUntrackableAdvice(["WRONG_VIEW"], "push_up")).toEqual([
      UNTRACKABLE_ADVICE.WRONG_VIEW,
      FORM_VIEW_HINTS.push_up,
    ]);
  });

  it("dedupes repeated reasons", () => {
    expect(
      buildUntrackableAdvice(["LOW_CONFIDENCE", "LOW_CONFIDENCE"], "squat"),
    ).toEqual([UNTRACKABLE_ADVICE.LOW_CONFIDENCE]);
  });
});

describe("formAnalysisResponseSchema", () => {
  it("parses SCORED and UNTRACKABLE results", () => {
    expect(formAnalysisResponseSchema.safeParse(scored).success).toBe(true);
    expect(
      formAnalysisResponseSchema.safeParse({
        ...base,
        outcome: "UNTRACKABLE",
        reasons: ["TOO_FAR"],
        advice: ["Move closer"],
      }).success,
    ).toBe(true);
  });

  it("strips a formScore field", () => {
    const parsed = formAnalysisResponseSchema.parse({
      ...scored,
      formScore: 80,
    });
    expect(parsed).not.toHaveProperty("formScore");
  });

  it("rejects 3 corrections and 0 positives", () => {
    const correction = scored.corrections[0];
    expect(
      formAnalysisResponseSchema.safeParse({
        ...scored,
        corrections: [correction, correction, correction],
      }).success,
    ).toBe(false);
    expect(
      formAnalysisResponseSchema.safeParse({ ...scored, positives: [] })
        .success,
    ).toBe(false);
  });
});

describe("recordedSetSchema", () => {
  it("parses a set that is still processing", () => {
    expect(
      recordedSetSchema.safeParse({
        sessionId: 1,
        workoutId: 2,
        setNumber: 1,
        exerciseCode: "squat",
        exerciseDisplayName: "Squat",
        performedAt: "2026-11-08T12:00:00.000Z",
        processingStatus: "PROCESSING",
        analysisStage: "QUEUED",
        analysisStageProgress: 0,
        failureReason: null,
        bullmqJobId: "job-1",
        outcome: null,
        band: null,
      }).success,
    ).toBe(true);
  });
});
