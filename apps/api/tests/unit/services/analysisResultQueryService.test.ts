import { getPrismaClient, SessionStatus } from "@repo/db";
import {
  buildUntrackableAdvice,
  formAnalysisResponseSchema,
} from "@repo/common";

import {
  ConflictError,
  InternalError,
  NotFoundError,
} from "../../../src/errors";

import {
  asPrismaClient,
  createPrismaMock,
  type PrismaMock,
} from "../helpers/prismaMock";

vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));

const { AnalysisResultQueryService } =
  await import("../../../src/services/analysisResultQueryService");

const USER = "user-uuid";
const USER_ID = 3;
const SESSION_ID = 7;
const ANALYZED_AT = new Date("2026-11-09T10:00:00Z");

const finding = (overrides: Record<string, unknown>) => ({
  findingType: "POSITIVE",
  severity: "MEDIUM",
  code: null,
  title: "What went well",
  description: "Good depth",
  correction: null,
  repNumbers: [],
  sortOrder: 0,
  ...overrides,
});

const scoredResult = (overrides: Record<string, unknown> = {}) => ({
  outcome: "SCORED",
  formScore: 82,
  scoreBreakdown: {
    ROM: { score: 88, isAssessed: true },
    CORE: { score: 76, isAssessed: true },
    SYMMETRY: { score: null, isAssessed: false },
  },
  summaryFeedback: "Solid set.",
  rawFeedback: {
    metricsVersion: "1",
    rubricVersion: "1",
    promptVersion: "1",
    repCount: 8,
    droppedRepCount: 0,
    reps: [],
    llmUsage: { inputTokens: 10, outputTokens: 5 },
  },
  untrackableReasons: [],
  analyzedAt: ANALYZED_AT,
  findings: [
    finding({ description: "Second", sortOrder: 1 }),
    finding({
      findingType: "CORRECTION",
      code: "HIPS_SAG",
      title: "Hips sag",
      description: "Hips dropped on late reps",
      correction: "Squeeze your glutes",
      severity: "HIGH",
      repNumbers: [6, 7],
    }),
    finding({ description: "First", repNumbers: [1, 2], sortOrder: 0 }),
  ],
  ...overrides,
});

const session = (overrides: Record<string, unknown> = {}) => ({
  id: SESSION_ID,
  workoutId: 9,
  setNumber: 2,
  processingStatus: SessionStatus.COMPLETED,
  exercise: { code: "push_up", displayName: "Push-up" },
  analysisResult: scoredResult(),
  ...overrides,
});

describe("AnalysisResultQueryService", () => {
  let service: InstanceType<typeof AnalysisResultQueryService>;
  let prisma: PrismaMock;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
    prisma.user.findUnique.mockResolvedValue({ id: USER_ID });
    service = new AnalysisResultQueryService();
  });

  describe("listRecordedSets", () => {
    const row = (overrides: Record<string, unknown> = {}) => ({
      id: 11,
      workoutId: 9,
      setNumber: 1,
      performedAt: ANALYZED_AT,
      processingStatus: SessionStatus.COMPLETED,
      analysisStage: null,
      analysisStageProgress: null,
      failureReason: null,
      bullmqJobId: "analysis-x",
      exercise: { code: "push_up", displayName: "Push-up" },
      analysisResult: { outcome: "SCORED", formScore: 91 },
      ...overrides,
    });

    it("throws NotFoundError when the workout is not owned", async () => {
      prisma.workout.findFirst.mockResolvedValue(null);

      await expect(service.listRecordedSets(USER, 9)).rejects.toThrow(
        new NotFoundError("Workout not found"),
      );
      expect(prisma.workoutSession.findMany).not.toHaveBeenCalled();
    });

    it("queries newest first, capped at 50, and maps band from the score", async () => {
      prisma.workout.findFirst.mockResolvedValue({ id: 9 });
      prisma.workoutSession.findMany.mockResolvedValue([
        row(),
        row({
          id: 10,
          processingStatus: SessionStatus.PROCESSING,
          analysisStage: "ANALYZING_REPS",
          analysisStageProgress: 0.5,
          analysisResult: null,
        }),
        row({
          id: 8,
          analysisResult: { outcome: "UNTRACKABLE", formScore: null },
        }),
      ]);

      const result = await service.listRecordedSets(USER, 9);

      expect(prisma.workoutSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workoutId: 9, userId: USER_ID },
          orderBy: [{ performedAt: "desc" }, { id: "desc" }],
          take: 50,
        }),
      );
      expect(
        result.map((set) => [set.sessionId, set.outcome, set.band]),
      ).toEqual([
        [11, "SCORED", "EXCELLENT"],
        [10, null, null],
        [8, "UNTRACKABLE", null],
      ]);
      expect(result[1]).toMatchObject({
        processingStatus: "PROCESSING",
        analysisStage: "ANALYZING_REPS",
        analysisStageProgress: 0.5,
      });
      expect(JSON.stringify(result)).not.toContain("formScore");
    });
  });

  describe("getSessionAnalysis", () => {
    it("maps a SCORED result to band, dimension chips, positives then corrections", async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(session());

      const result = await service.getSessionAnalysis(USER, SESSION_ID);

      expect(prisma.workoutSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SESSION_ID, userId: USER_ID } }),
      );
      expect(result).toEqual({
        sessionId: SESSION_ID,
        workoutId: 9,
        setNumber: 2,
        exerciseCode: "push_up",
        exerciseDisplayName: "Push-up",
        analyzedAt: ANALYZED_AT.toISOString(),
        outcome: "SCORED",
        band: "GOOD",
        repCount: 8,
        summary: "Solid set.",
        dimensions: [
          { dimension: "ROM", band: "GOOD", isAssessed: true },
          { dimension: "CORE", band: "GOOD", isAssessed: true },
          { dimension: "SYMMETRY", band: null, isAssessed: false },
        ],
        positives: [
          { text: "First", repNumbers: [1, 2] },
          { text: "Second", repNumbers: [] },
        ],
        corrections: [
          {
            code: "HIPS_SAG",
            title: "Hips sag",
            cue: "Squeeze your glutes",
            detail: "Hips dropped on late reps",
            severity: "HIGH",
            repNumbers: [6, 7],
          },
        ],
      });
      expect(formAnalysisResponseSchema.safeParse(result).success).toBe(true);
      expect(JSON.stringify(result)).not.toContain("formScore");
    });

    it("returns reasons and advice for an UNTRACKABLE result", async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(
        session({
          analysisResult: {
            outcome: "UNTRACKABLE",
            formScore: null,
            scoreBreakdown: {},
            summaryFeedback: null,
            rawFeedback: {},
            untrackableReasons: ["WRONG_VIEW"],
            analyzedAt: ANALYZED_AT,
            findings: [],
          },
        }),
      );

      const result = await service.getSessionAnalysis(USER, SESSION_ID);

      expect(result).toMatchObject({
        outcome: "UNTRACKABLE",
        reasons: ["WRONG_VIEW"],
        advice: buildUntrackableAdvice(["WRONG_VIEW"], "push_up"),
      });
      expect(JSON.stringify(result)).not.toContain("formScore");
    });

    it("throws NotFoundError for a session the user does not own", async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);

      await expect(
        service.getSessionAnalysis(USER, SESSION_ID),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it.each([
      ["a PROCESSING session", session({ processingStatus: "PROCESSING" })],
      ["a COMPLETED session with no result", session({ analysisResult: null })],
    ])("throws ANALYSIS_NOT_READY for %s", async (_label, row) => {
      prisma.workoutSession.findFirst.mockResolvedValue(row);

      const error: unknown = await service
        .getSessionAnalysis(USER, SESSION_ID)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe("ANALYSIS_NOT_READY");
    });

    it("throws InternalError when the stored breakdown is corrupt", async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(
        session({
          analysisResult: scoredResult({ scoreBreakdown: { ROM: "bad" } }),
        }),
      );

      await expect(
        service.getSessionAnalysis(USER, SESSION_ID),
      ).rejects.toBeInstanceOf(InternalError);
    });
  });
});
