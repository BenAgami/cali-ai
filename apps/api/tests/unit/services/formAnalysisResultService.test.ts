import type { FormFeedbackOutcome } from "../../../src/services/feedbackService";
import {
  storedRawFeedbackSchema,
  storedScoreBreakdownSchema,
} from "../../../src/utils/storedAnalysis";
import {
  asPrismaClient,
  createPrismaMock,
  type PrismaMock,
} from "../helpers/prismaMock";
import { makeScoredMetrics } from "../helpers/scoredMetrics";
import { METRICS_VERSION } from "../../../src/metrics/types";
import { FORM_FEEDBACK_PROMPT_VERSION } from "../../../src/prompts/formFeedbackPrompt";

const { FormAnalysisResultService } =
  await import("../../../src/services/formAnalysisResultService");

const outcome: FormFeedbackOutcome = {
  feedback: {
    summary: "Solid set with a few things to tidy up.",
    positives: [
      { text: "Great depth on the first reps", repNumbers: [1, 2] },
      { text: "You kept a steady tempo", repNumbers: [] },
    ],
    corrections: [
      {
        tag: "PU_HIP_SAG",
        dimension: "CORE",
        severity: "MEDIUM",
        title: "Hips sagging",
        cue: "Squeeze your glutes",
        detail: "Your hips dropped on later reps.",
        repNumbers: [3, 4, 5],
      },
      {
        tag: "PU_SHALLOW_DEPTH",
        dimension: "ROM",
        severity: "LOW",
        title: "Shallow depth",
        cue: "Go a little lower",
        detail: "Chest stayed high.",
        repNumbers: [4, 5],
      },
    ],
  },
  model: "claude-sonnet-5-5",
  promptVersion: FORM_FEEDBACK_PROMPT_VERSION,
  usage: { inputTokens: 100, outputTokens: 50 },
  attempts: 1,
};

let tx: PrismaMock;
let service: InstanceType<typeof FormAnalysisResultService>;

beforeEach(() => {
  tx = createPrismaMock();
  tx.analysisResult.upsert.mockResolvedValue({ id: 11 });
  tx.analysisFinding.deleteMany.mockResolvedValue({ count: 0 });
  tx.analysisFinding.createMany.mockResolvedValue({ count: 0 });
  service = new FormAnalysisResultService();
});

describe("FormAnalysisResultService.saveScored", () => {
  it("upserts a SCORED result with stored-schema JSON", async () => {
    await expect(
      service.saveScored(asPrismaClient(tx), 5, makeScoredMetrics(), outcome),
    ).resolves.toBeUndefined();

    const args = tx.analysisResult.upsert.mock.calls[0][0] as {
      where: unknown;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(args.where).toEqual({ sessionId: 5 });
    expect(args.create).toMatchObject({
      sessionId: 5,
      outcome: "SCORED",
      formScore: 61,
      summaryFeedback: outcome.feedback.summary,
      aiModelName: "claude-sonnet-5-5",
      untrackableReasons: [],
    });
    expect(args.update).toMatchObject({ outcome: "SCORED", formScore: 61 });
    expect(args.update).not.toHaveProperty("sessionId");
    expect(
      storedScoreBreakdownSchema.parse(args.create.scoreBreakdown),
    ).toEqual({
      ROM: { score: 80, isAssessed: true },
      CORE: { score: 50, isAssessed: true },
      SYMMETRY: { score: null, isAssessed: false },
    });
    expect(
      storedRawFeedbackSchema.parse(args.create.rawFeedback),
    ).toMatchObject({
      metricsVersion: METRICS_VERSION,
      rubricVersion: "rubric-v0",
      promptVersion: FORM_FEEDBACK_PROMPT_VERSION,
      repCount: 5,
      droppedRepCount: 0,
      llmUsage: { inputTokens: 100, outputTokens: 50 },
    });
  });

  it("replaces findings: positives first, then corrections with rep timing", async () => {
    await service.saveScored(
      asPrismaClient(tx),
      5,
      makeScoredMetrics(),
      outcome,
    );

    expect(tx.analysisFinding.deleteMany).toHaveBeenCalledWith({
      where: { analysisResultId: 11 },
    });
    const { data } = tx.analysisFinding.createMany.mock.calls[0][0] as {
      data: Record<string, unknown>[];
    };
    expect(data).toHaveLength(4);
    expect(data[0]).toMatchObject({
      analysisResultId: 11,
      findingType: "POSITIVE",
      severity: "LOW",
      title: "What went well",
      description: "Great depth on the first reps",
      repNumbers: [1, 2],
      sortOrder: 0,
    });
    expect(data[1]).toMatchObject({ findingType: "POSITIVE", sortOrder: 1 });
    expect(data[2]).toMatchObject({
      findingType: "CORRECTION",
      severity: "MEDIUM",
      code: "PU_HIP_SAG",
      title: "Hips sagging",
      description: "Your hips dropped on later reps.",
      correction: "Squeeze your glutes",
      repNumbers: [3, 4, 5],
      startSec: 3,
      endSec: 4,
      sortOrder: 0,
    });
    expect(data[3]).toMatchObject({
      code: "PU_SHALLOW_DEPTH",
      startSec: 4,
      endSec: 5,
      sortOrder: 1,
    });
  });

  it("deletes findings before creating them so a retry cannot duplicate", async () => {
    await service.saveScored(
      asPrismaClient(tx),
      5,
      makeScoredMetrics(),
      outcome,
    );

    const deleteOrder =
      tx.analysisFinding.deleteMany.mock.invocationCallOrder[0];
    const createOrder =
      tx.analysisFinding.createMany.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });
});

describe("FormAnalysisResultService.saveUntrackable", () => {
  const untrackable = {
    outcome: "UNTRACKABLE" as const,
    exerciseCode: "push_up" as const,
    reasons: ["NO_REPS_DETECTED" as const],
    metricsVersion: METRICS_VERSION,
    rubricVersion: "rubric-v0",
  };

  it("stores an UNTRACKABLE result with reasons and clears findings", async () => {
    await expect(
      service.saveUntrackable(asPrismaClient(tx), 5, untrackable),
    ).resolves.toBeUndefined();

    const args = tx.analysisResult.upsert.mock.calls[0][0] as {
      create: Record<string, unknown>;
    };
    expect(args.create).toMatchObject({
      sessionId: 5,
      outcome: "UNTRACKABLE",
      formScore: null,
      scoreBreakdown: {},
      untrackableReasons: ["NO_REPS_DETECTED"],
      summaryFeedback: null,
    });
    expect(storedRawFeedbackSchema.parse(args.create.rawFeedback)).toEqual({
      metricsVersion: METRICS_VERSION,
      rubricVersion: "rubric-v0",
      promptVersion: null,
      repCount: 0,
      droppedRepCount: 0,
      reps: [],
      llmUsage: null,
    });
    expect(tx.analysisFinding.deleteMany).toHaveBeenCalledWith({
      where: { analysisResultId: 11 },
    });
    expect(tx.analysisFinding.createMany).not.toHaveBeenCalled();
  });
});
