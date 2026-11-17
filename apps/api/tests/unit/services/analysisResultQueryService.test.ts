import { getPrismaClient, ProcessingStatus } from "@repo/db";
import {
  buildUntrackableAdvice,
  formAnalysisResponseSchema,
} from "@repo/common";

import { lookAheadTake } from "../../../src/utils/pagination";
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
const RECORDED_SET_ID = 7;
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
  // Supplied in the query's order: findingType asc, then sortOrder asc.
  findings: [
    finding({ description: "First", repNumbers: [1, 2], sortOrder: 0 }),
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
  ],
  ...overrides,
});

const recordedSet = (overrides: Record<string, unknown> = {}) => ({
  id: RECORDED_SET_ID,
  workoutPlanId: 9,
  setNumber: 2,
  processingStatus: ProcessingStatus.COMPLETED,
  workoutRun: null,
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
      workoutPlanId: 9,
      workoutRunId: 4,
      setNumber: 1,
      performedAt: ANALYZED_AT,
      processingStatus: ProcessingStatus.COMPLETED,
      analysisStage: null,
      analysisStageProgress: null,
      failureReason: null,
      bullmqJobId: "analysis-x",
      exercise: { code: "push_up", displayName: "Push-up" },
      analysisResult: { outcome: "SCORED", formScore: 91 },
      ...overrides,
    });

    const query = { limit: 50, offset: 0 };

    it("throws NotFoundError when the workout is not owned", async () => {
      prisma.workoutPlan.findFirst.mockResolvedValue(null);

      await expect(service.listRecordedSets(USER, 9, query)).rejects.toThrow(
        new NotFoundError("Workout not found"),
      );
      expect(prisma.recordedSet.findMany).not.toHaveBeenCalled();
    });

    it("queries newest first with a look-ahead row and maps band from the score", async () => {
      prisma.workoutPlan.findFirst.mockResolvedValue({ id: 9 });
      prisma.recordedSet.findMany.mockResolvedValue([
        row(),
        row({
          id: 10,
          processingStatus: ProcessingStatus.PROCESSING,
          analysisStage: "ANALYZING_REPS",
          analysisStageProgress: 0.5,
          analysisResult: null,
        }),
        row({
          id: 8,
          analysisResult: { outcome: "UNTRACKABLE", formScore: null },
        }),
      ]);

      const { items: result } = await service.listRecordedSets(USER, 9, query);

      expect(prisma.recordedSet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workoutPlanId: 9,
            userId: USER_ID,
            processingStatus: { not: ProcessingStatus.PENDING },
          },
          orderBy: [{ performedAt: "desc" }, { id: "desc" }],
          skip: 0,
          take: 51,
        }),
      );
      expect(
        result.map((set) => [set.recordedSetId, set.outcome, set.band]),
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

    it("scopes the query to one run and maps workoutRunId when given", async () => {
      prisma.workoutPlan.findFirst.mockResolvedValue({ id: 9 });
      prisma.recordedSet.findMany.mockResolvedValue([row()]);

      const { items: result } = await service.listRecordedSets(USER, 9, {
        ...query,
        workoutRunId: 4,
      });

      expect(prisma.recordedSet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workoutPlanId: 9,
            userId: USER_ID,
            workoutRunId: 4,
            processingStatus: { not: ProcessingStatus.PENDING },
          },
        }),
      );
      expect(result[0]).toMatchObject({ workoutRunId: 4 });
    });

    it("pages with skip and a look-ahead take, trimming the extra row", async () => {
      prisma.workoutPlan.findFirst.mockResolvedValue({ id: 9 });
      prisma.recordedSet.findMany.mockResolvedValue(
        [20, 19, 18, 17, 16, 15].map((id) => row({ id })),
      );

      const result = await service.listRecordedSets(USER, 9, {
        limit: 5,
        offset: 10,
      });

      expect(prisma.recordedSet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: lookAheadTake(5) }),
      );
      expect(result.items).toHaveLength(5);
      expect(result.page).toEqual({
        limit: 5,
        offset: 10,
        hasMore: true,
        nextOffset: 15,
      });
    });
  });

  describe("getRecordedSetAnalysis", () => {
    it("maps a SCORED result to band, dimension chips, positives then corrections", async () => {
      prisma.recordedSet.findFirst.mockResolvedValue(recordedSet());

      const result = await service.getRecordedSetAnalysis(
        USER,
        RECORDED_SET_ID,
      );

      expect(prisma.recordedSet.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: RECORDED_SET_ID, userId: USER_ID },
        }),
      );
      expect(result).toEqual({
        recordedSetId: RECORDED_SET_ID,
        workoutPlanId: 9,
        openWorkoutRunId: null,
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

    it.each([
      [null, 4],
      [ANALYZED_AT, null],
    ])(
      "links the set's run only while it is open (completedAt %s)",
      async (completedAt, expected) => {
        prisma.recordedSet.findFirst.mockResolvedValue(
          recordedSet({ workoutRun: { id: 4, completedAt } }),
        );

        const result = await service.getRecordedSetAnalysis(
          USER,
          RECORDED_SET_ID,
        );

        expect(result.openWorkoutRunId).toBe(expected);
      },
    );

    it("returns reasons and advice for an UNTRACKABLE result", async () => {
      prisma.recordedSet.findFirst.mockResolvedValue(
        recordedSet({
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

      const result = await service.getRecordedSetAnalysis(
        USER,
        RECORDED_SET_ID,
      );

      expect(result).toMatchObject({
        outcome: "UNTRACKABLE",
        reasons: ["WRONG_VIEW"],
        advice: buildUntrackableAdvice(["WRONG_VIEW"], "push_up"),
      });
      expect(JSON.stringify(result)).not.toContain("formScore");
    });

    it("answers stored reasons that are all unknown with generic advice", async () => {
      prisma.recordedSet.findFirst.mockResolvedValue(
        recordedSet({
          analysisResult: {
            outcome: "UNTRACKABLE",
            formScore: null,
            scoreBreakdown: {},
            summaryFeedback: null,
            rawFeedback: {},
            untrackableReasons: ["RENAMED_REASON"],
            analyzedAt: ANALYZED_AT,
            findings: [],
          },
        }),
      );

      const result = await service.getRecordedSetAnalysis(
        USER,
        RECORDED_SET_ID,
      );

      expect(result).toMatchObject({
        outcome: "UNTRACKABLE",
        reasons: [],
        advice: [
          "We couldn't analyse this recording. Try again with your whole body in view.",
        ],
      });
    });

    it("throws NotFoundError for a recorded set the user does not own", async () => {
      prisma.recordedSet.findFirst.mockResolvedValue(null);

      await expect(
        service.getRecordedSetAnalysis(USER, RECORDED_SET_ID),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it.each([
      [
        "a PROCESSING recorded set",
        recordedSet({ processingStatus: "PROCESSING" }),
      ],
      [
        "a COMPLETED recorded set with no result",
        recordedSet({ analysisResult: null }),
      ],
    ])("throws ANALYSIS_NOT_READY for %s", async (_label, row) => {
      prisma.recordedSet.findFirst.mockResolvedValue(row);

      const error: unknown = await service
        .getRecordedSetAnalysis(USER, RECORDED_SET_ID)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe("ANALYSIS_NOT_READY");
    });

    it("throws InternalError when the stored breakdown is corrupt", async () => {
      prisma.recordedSet.findFirst.mockResolvedValue(
        recordedSet({
          analysisResult: scoredResult({ scoreBreakdown: { ROM: "bad" } }),
        }),
      );

      await expect(
        service.getRecordedSetAnalysis(USER, RECORDED_SET_ID),
      ).rejects.toBeInstanceOf(InternalError);
    });
  });
});
