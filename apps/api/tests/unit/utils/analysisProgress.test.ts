import { ANALYSIS_STAGES, analysisStatusEventSchema } from "@repo/common";
import { SessionStatus } from "@repo/db";

import {
  progressPercent,
  toStatusEvent,
  type AnalysisSnapshot,
} from "../../../src/utils/analysisProgress";

const snapshot = (overrides: Partial<AnalysisSnapshot>): AnalysisSnapshot => ({
  id: 7,
  processingStatus: SessionStatus.PROCESSING,
  analysisStage: null,
  analysisStageProgress: null,
  failureReason: null,
  ...overrides,
});

describe.only("progressPercent", () => {
  it.for([
    ["QUEUED", 0],
    ["ANALYZING_REPS", 10],
    ["WRITING_FEEDBACK", 60],
    ["COMPLETED", 100],
  ] as const)("%s with no sub-progress is %i percent", ([stage, expected]) => {
    expect(progressPercent(stage)).toBe(expected);
  });

  it.for([
    ["ANALYZING_REPS", 0.5, 35],
    ["WRITING_FEEDBACK", 1, 95],
    ["ANALYZING_REPS", -1, 10],
    ["ANALYZING_REPS", 2, 60],
    ["ANALYZING_REPS", null, 10],
    ["ANALYZING_REPS", undefined, 10],
    ["ANALYZING_REPS", Number.NaN, 10],
  ] as const)("%s with sub %s is %i percent", ([stage, sub, expected]) => {
    expect(progressPercent(stage, sub)).toBe(expected);
  });

  it("never decreases across stages and sub-progress values", () => {
    const percents = ANALYSIS_STAGES.flatMap((stage) =>
      [0, 0.25, 0.5, 0.75, 1].map((sub) => progressPercent(stage, sub)),
    );

    percents.forEach((value, index) => {
      if (index > 0) expect(value).toBeGreaterThanOrEqual(percents[index - 1]);
    });
  });

  it("only reports 100 for COMPLETED", () => {
    ANALYSIS_STAGES.filter((stage) => stage !== "COMPLETED").forEach((stage) =>
      [0, 0.5, 1, 5].forEach((sub) =>
        expect(progressPercent(stage, sub)).toBeLessThanOrEqual(99),
      ),
    );
  });
});

describe("toStatusEvent", () => {
  it("returns null for a PENDING session", () => {
    expect(
      toStatusEvent(snapshot({ processingStatus: SessionStatus.PENDING })),
    ).toBeNull();
  });

  it("maps PROCESSING at QUEUED to status QUEUED", () => {
    const event = toStatusEvent(snapshot({ analysisStage: "QUEUED" }));

    expect(event).toMatchObject({ status: "QUEUED", progress_percent: 0 });
  });

  it("treats a null stage as QUEUED", () => {
    expect(toStatusEvent(snapshot({ analysisStage: null }))).toMatchObject({
      status: "QUEUED",
      stage: "QUEUED",
    });
  });

  it("maps PROCESSING mid-analysis with interpolated progress", () => {
    const event = toStatusEvent(
      snapshot({ analysisStage: "ANALYZING_REPS", analysisStageProgress: 0.5 }),
    );

    expect(event).toMatchObject({
      sessionId: 7,
      status: "PROCESSING",
      progress_percent: 35,
      stage_label: "analyzing reps",
      failure_reason: null,
    });
  });

  it("maps COMPLETED to 100 percent", () => {
    const event = toStatusEvent(
      snapshot({
        processingStatus: SessionStatus.COMPLETED,
        analysisStage: "WRITING_FEEDBACK",
      }),
    );

    expect(event).toMatchObject({
      status: "COMPLETED",
      stage: "COMPLETED",
      progress_percent: 100,
      stage_label: "done",
      failure_reason: null,
    });
  });

  it("keeps the last reached stage and percent when FAILED", () => {
    const event = toStatusEvent(
      snapshot({
        processingStatus: SessionStatus.FAILED,
        analysisStage: "WRITING_FEEDBACK",
        failureReason: "TIMEOUT",
      }),
    );

    expect(event).toMatchObject({
      status: "FAILED",
      stage: "WRITING_FEEDBACK",
      progress_percent: 60,
      failure_reason: "TIMEOUT",
    });
  });

  it("caps percent at 99 when FAILED carries a COMPLETED stage", () => {
    const event = toStatusEvent(
      snapshot({
        processingStatus: SessionStatus.FAILED,
        analysisStage: "COMPLETED",
        failureReason: "X",
      }),
    );

    expect(event?.progress_percent).toBe(99);
  });

  it.for([
    snapshot({ analysisStage: "QUEUED" }),
    snapshot({ analysisStage: "ANALYZING_REPS", analysisStageProgress: 0.3 }),
    snapshot({ processingStatus: SessionStatus.COMPLETED }),
    snapshot({
      processingStatus: SessionStatus.FAILED,
      failureReason: "LLM_ERROR",
    }),
  ])("produces an event that satisfies the shared schema (%#)", (snap) => {
    const event = toStatusEvent(snap);

    expect(event).not.toBeNull();
    expect(() => analysisStatusEventSchema.parse(event)).not.toThrow();
  });
});
