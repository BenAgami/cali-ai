import { getPrismaClient, SessionStatus } from "@repo/db";

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

vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));

const { FormAnalysisResultService } =
  await import("../../../src/services/formAnalysisResultService");

const JOB = "job-1";

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
  promptVersion: "form-feedback-v1",
  usage: { inputTokens: 100, outputTokens: 50 },
  attempts: 1,
};

let prisma: PrismaMock;
let service: InstanceType<typeof FormAnalysisResultService>;

beforeEach(() => {
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  prisma.workoutSession.count.mockResolvedValue(1);
  prisma.analysisResult.upsert.mockResolvedValue({ id: 11 });
  prisma.analysisFinding.deleteMany.mockResolvedValue({ count: 0 });
  prisma.analysisFinding.createMany.mockResolvedValue({ count: 0 });
  service = new FormAnalysisResultService();
});

describe("FormAnalysisResultService.saveScored", () => {
  it("writes nothing and returns false when the run guard fails", async () => {
    prisma.workoutSession.count.mockResolvedValue(0);

    await expect(
      service.saveScored(5, JOB, makeScoredMetrics(), outcome),
    ).resolves.toBe(false);

    expect(prisma.workoutSession.count).toHaveBeenCalledWith({
      where: {
        id: 5,
        processingStatus: SessionStatus.PROCESSING,
        bullmqJobId: JOB,
      },
    });
    expect(prisma.analysisResult.upsert).not.toHaveBeenCalled();
    expect(prisma.analysisFinding.deleteMany).not.toHaveBeenCalled();
    expect(prisma.analysisFinding.createMany).not.toHaveBeenCalled();
  });

  it("upserts a SCORED result with stored-schema JSON", async () => {
    await expect(
      service.saveScored(5, JOB, makeScoredMetrics(), outcome),
    ).resolves.toBe(true);

    const args = prisma.analysisResult.upsert.mock.calls[0][0] as {
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
      metricsVersion: "metrics-v1",
      rubricVersion: "rubric-v0",
      promptVersion: "form-feedback-v1",
      repCount: 5,
      droppedRepCount: 0,
      llmUsage: { inputTokens: 100, outputTokens: 50 },
    });
  });

  it("replaces findings: positives first, then corrections with rep timing", async () => {
    await service.saveScored(5, JOB, makeScoredMetrics(), outcome);

    expect(prisma.analysisFinding.deleteMany).toHaveBeenCalledWith({
      where: { analysisResultId: 11 },
    });
    const { data } = prisma.analysisFinding.createMany.mock.calls[0][0] as {
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
    await service.saveScored(5, JOB, makeScoredMetrics(), outcome);

    const deleteOrder =
      prisma.analysisFinding.deleteMany.mock.invocationCallOrder[0];
    const createOrder =
      prisma.analysisFinding.createMany.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });
});

describe("FormAnalysisResultService.saveUntrackable", () => {
  const untrackable = {
    outcome: "UNTRACKABLE" as const,
    exerciseCode: "push_up" as const,
    reasons: ["NO_REPS_DETECTED" as const],
    metricsVersion: "metrics-v1",
    rubricVersion: "rubric-v0",
  };

  it("writes nothing when the run guard fails", async () => {
    prisma.workoutSession.count.mockResolvedValue(0);

    await expect(service.saveUntrackable(5, JOB, untrackable)).resolves.toBe(
      false,
    );

    expect(prisma.analysisResult.upsert).not.toHaveBeenCalled();
  });

  it("stores an UNTRACKABLE result with reasons and clears findings", async () => {
    await expect(service.saveUntrackable(5, JOB, untrackable)).resolves.toBe(
      true,
    );

    const args = prisma.analysisResult.upsert.mock.calls[0][0] as {
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
      metricsVersion: "metrics-v1",
      rubricVersion: "rubric-v0",
      promptVersion: null,
      repCount: 0,
      droppedRepCount: 0,
      reps: [],
      llmUsage: null,
    });
    expect(prisma.analysisFinding.deleteMany).toHaveBeenCalledWith({
      where: { analysisResultId: 11 },
    });
    expect(prisma.analysisFinding.createMany).not.toHaveBeenCalled();
  });
});
