import { getPrismaClient, ProcessingStatus } from "@repo/db";

import {
  NotFoundError,
  BadRequestError,
  PreconditionRequiredError,
} from "../../../src/errors";
import aiPrerequisitesService from "../../../src/services/aiPrerequisitesService";
import workoutPlanService from "../../../src/services/workoutPlanService";

import {
  asPrismaClient,
  createPrismaMock,
  type PrismaMock,
} from "../helpers/prismaMock";

vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));

vi.mock("../../../src/services/aiPrerequisitesService", () => ({
  default: { assertAiPrerequisites: vi.fn() },
}));

vi.mock("../../../src/services/workoutPlanService", () => ({
  default: { assertOpenWorkoutRun: vi.fn() },
}));

vi.mock("../../../src/services/aiPrerequisitesService", () => ({
  default: { assertAiPrerequisites: vi.fn() },
}));

const { RecordedSetService } =
  await import("../../../src/services/recordedSetService");

const USER_UUID = "uuid-1";
const baseDto = { exerciseCode: "push_up" } as const;

const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: i + 1 }));

let prisma: PrismaMock;
let recordedSetService: InstanceType<typeof RecordedSetService>;

/** Resolves the private uuid → id lookup and the active-exercise lookup. */
const givenUserAndExercise = () => {
  prisma.user.findUnique.mockResolvedValue({ id: 42 });
  prisma.exercise.findFirst.mockResolvedValue({ id: 7, code: "push_up" });
  prisma.recordedSet.create.mockResolvedValue({ id: 1 });
};

const createData = () => prisma.recordedSet.create.mock.calls[0][0].data;

beforeEach(() => {
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  recordedSetService = new RecordedSetService();
  vi.mocked(aiPrerequisitesService.assertAiPrerequisites).mockResolvedValue({
    userId: 42,
    experienceLevel: "BEGINNER",
    goal: { goalType: "STRENGTH", title: "Get stronger" },
    heightCm: 180,
    weightKg: 75,
  });
});

describe("RecordedSetService.createRecordedSet", () => {
  it("checks AI prerequisites before any exercise query and propagates failures", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    vi.mocked(aiPrerequisitesService.assertAiPrerequisites).mockRejectedValue(
      new PreconditionRequiredError("no consent", "AI_CONSENT_REQUIRED"),
    );

    await expect(
      recordedSetService.createRecordedSet(USER_UUID, baseDto),
    ).rejects.toBeInstanceOf(PreconditionRequiredError);
    expect(aiPrerequisitesService.assertAiPrerequisites).toHaveBeenCalledWith(
      42,
    );
    expect(prisma.exercise.findFirst).not.toHaveBeenCalled();
  });

  it("verifies workout ownership and membership when workoutPlanId is set", async () => {
    givenUserAndExercise();
    prisma.workoutPlan.findFirst.mockResolvedValue({
      id: 5,
      exercises: [{ exercise: { code: "push_up" } }],
    });

    await recordedSetService.createRecordedSet(USER_UUID, {
      ...baseDto,
      workoutPlanId: 5,
      setNumber: 2,
    });

    expect(prisma.workoutPlan.findFirst).toHaveBeenCalledWith({
      where: { id: 5, userId: 42 },
      select: {
        id: true,
        exercises: { select: { exercise: { select: { code: true } } } },
      },
    });
    expect(createData()).toMatchObject({
      userId: 42,
      exerciseId: 7,
      workoutPlanId: 5,
      setNumber: 2,
    });
  });

  it("stores null workoutPlanId and setNumber when omitted", async () => {
    givenUserAndExercise();

    await recordedSetService.createRecordedSet(USER_UUID, baseDto);

    expect(prisma.workoutPlan.findFirst).not.toHaveBeenCalled();
    expect(createData()).toMatchObject({
      workoutPlanId: null,
      setNumber: null,
    });
  });

  it("rejects a workout the user does not own", async () => {
    givenUserAndExercise();
    prisma.workoutPlan.findFirst.mockResolvedValue(null);

    await expect(
      recordedSetService.createRecordedSet(USER_UUID, {
        ...baseDto,
        workoutPlanId: 5,
      }),
    ).rejects.toThrow(new NotFoundError("Workout not found"));
    expect(prisma.recordedSet.create).not.toHaveBeenCalled();
  });

  it("rejects an exercise that is not part of the workout", async () => {
    givenUserAndExercise();
    prisma.workoutPlan.findFirst.mockResolvedValue({
      id: 5,
      exercises: [{ exercise: { code: "squat" } }],
    });

    await expect(
      recordedSetService.createRecordedSet(USER_UUID, {
        ...baseDto,
        workoutPlanId: 5,
      }),
    ).rejects.toThrow(
      new BadRequestError("Exercise is not part of this workout"),
    );
  });

  it("rejects an unknown user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      recordedSetService.createRecordedSet(USER_UUID, baseDto),
    ).rejects.toThrow(new NotFoundError("User not found"));
    expect(prisma.recordedSet.create).not.toHaveBeenCalled();
  });

  it("checks AI prerequisites before any exercise or workout query and propagates failures", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    vi.mocked(aiPrerequisitesService.assertAiPrerequisites).mockRejectedValue(
      new PreconditionRequiredError("no consent", "AI_CONSENT_REQUIRED"),
    );

    await expect(
      recordedSetService.createRecordedSet(USER_UUID, baseDto),
    ).rejects.toBeInstanceOf(PreconditionRequiredError);
    expect(aiPrerequisitesService.assertAiPrerequisites).toHaveBeenCalledWith(
      42,
    );
    expect(prisma.exercise.findFirst).not.toHaveBeenCalled();
    expect(prisma.workoutPlan.findFirst).not.toHaveBeenCalled();
  });

  it("looks up the owned workout and links the recorded set to it", async () => {
    givenUserAndExercise();
    prisma.workoutPlan.findFirst.mockResolvedValue({
      id: 5,
      exercises: [{ exercise: { code: "push_up" } }],
    });

    await recordedSetService.createRecordedSet(USER_UUID, {
      ...baseDto,
      workoutPlanId: 5,
      setNumber: 2,
    });

    expect(prisma.workoutPlan.findFirst).toHaveBeenCalledWith({
      where: { id: 5, userId: 42 },
      select: {
        id: true,
        exercises: { select: { exercise: { select: { code: true } } } },
      },
    });
    expect(createData()).toMatchObject({
      userId: 42,
      exerciseId: 7,
      workoutPlanId: 5,
      setNumber: 2,
    });
  });

  it("checks the run belongs to the user and workout before linking it", async () => {
    givenUserAndExercise();
    prisma.workoutPlan.findFirst.mockResolvedValue({
      id: 5,
      exercises: [{ exercise: { code: "push_up" } }],
    });

    await recordedSetService.createRecordedSet(USER_UUID, {
      ...baseDto,
      workoutPlanId: 5,
      workoutRunId: 9,
    });

    expect(workoutPlanService.assertOpenWorkoutRun).toHaveBeenCalledWith(
      42,
      5,
      9,
    );
    expect(createData()).toMatchObject({ workoutPlanId: 5, workoutRunId: 9 });
  });

  it("stores null workoutPlanId and setNumber when not supplied", async () => {
    givenUserAndExercise();

    await recordedSetService.createRecordedSet(USER_UUID, baseDto);

    expect(prisma.workoutPlan.findFirst).not.toHaveBeenCalled();
    expect(createData()).toMatchObject({
      workoutPlanId: null,
      setNumber: null,
    });
  });

  it("rejects a workout the user does not own", async () => {
    givenUserAndExercise();
    prisma.workoutPlan.findFirst.mockResolvedValue(null);

    await expect(
      recordedSetService.createRecordedSet(USER_UUID, {
        ...baseDto,
        workoutPlanId: 5,
      }),
    ).rejects.toThrow(new NotFoundError("Workout not found"));
    expect(prisma.recordedSet.create).not.toHaveBeenCalled();
  });

  it("rejects an exercise that is not in the workout", async () => {
    givenUserAndExercise();
    prisma.workoutPlan.findFirst.mockResolvedValue({
      id: 5,
      exercises: [{ exercise: { code: "squat" } }],
    });

    await expect(
      recordedSetService.createRecordedSet(USER_UUID, {
        ...baseDto,
        workoutPlanId: 5,
      }),
    ).rejects.toThrow(
      new BadRequestError("Exercise is not part of this workout"),
    );
  });

  it("normalizes the exercise code and requires the exercise to be active", async () => {
    givenUserAndExercise();

    await recordedSetService.createRecordedSet(USER_UUID, {
      // the route schema trims/lowercases; the service normalizes again defensively
      exerciseCode: "  PUSH_UP " as "push_up",
    });

    expect(prisma.exercise.findFirst.mock.calls[0][0].where).toEqual({
      code: "push_up",
      isActive: true,
    });
  });

  it("rejects an unknown or inactive exercise", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.exercise.findFirst.mockResolvedValue(null);

    await expect(
      recordedSetService.createRecordedSet(USER_UUID, baseDto),
    ).rejects.toThrow(new NotFoundError("Exercise not found"));
    expect(prisma.recordedSet.create).not.toHaveBeenCalled();
  });

  it("starts every recorded set in the PENDING state", async () => {
    givenUserAndExercise();

    await recordedSetService.createRecordedSet(USER_UUID, baseDto);

    expect(createData().processingStatus).toBe(ProcessingStatus.PENDING);
  });

  it("rejects an unparseable performedAt", async () => {
    givenUserAndExercise();

    await expect(
      recordedSetService.createRecordedSet(USER_UUID, {
        ...baseDto,
        performedAt: "garbage",
      }),
    ).rejects.toThrow(new BadRequestError("Invalid performedAt value"));
    expect(prisma.recordedSet.create).not.toHaveBeenCalled();
  });

  it("passes a valid performedAt through as a Date", async () => {
    givenUserAndExercise();

    await recordedSetService.createRecordedSet(USER_UUID, {
      ...baseDto,
      performedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(createData().performedAt).toEqual(
      new Date("2026-01-01T00:00:00.000Z"),
    );
  });

  it("leaves performedAt undefined when omitted so the column default applies", async () => {
    givenUserAndExercise();

    await recordedSetService.createRecordedSet(USER_UUID, baseDto);

    expect(createData().performedAt).toBeUndefined();
  });
});

describe("RecordedSetService.listRecordedSets", () => {
  const list = (limit: number, offset = 0, exerciseCode?: string) =>
    recordedSetService.listRecordedSets({
      userUuid: USER_UUID,
      limit,
      offset,
      exerciseCode,
    });

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
  });

  it("rejects an unknown user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(list(10)).rejects.toThrow(new NotFoundError("User not found"));
  });

  it("adds a normalized exercise filter when a code is supplied", async () => {
    prisma.recordedSet.findMany.mockResolvedValue([]);

    await list(10, 0, "  PUSH_UP ");

    expect(prisma.recordedSet.findMany.mock.calls[0][0].where).toEqual({
      userId: 42,
      exercise: { code: "push_up" },
    });
  });

  it("adds the processingStatus filter and selects outcome, never formScore", async () => {
    prisma.recordedSet.findMany.mockResolvedValue([]);

    await recordedSetService.listRecordedSets({
      userUuid: USER_UUID,
      limit: 10,
      offset: 0,
      processingStatus: ProcessingStatus.PROCESSING,
    });

    const args = prisma.recordedSet.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: 42, processingStatus: "PROCESSING" });
    expect(args.include.analysisResult.select).toEqual({
      outcome: true,
      analyzedAt: true,
      summaryFeedback: true,
    });
  });

  it("adds the processingStatus filter and selects outcome, not formScore", async () => {
    prisma.recordedSet.findMany.mockResolvedValue([]);

    await recordedSetService.listRecordedSets({
      userUuid: USER_UUID,
      limit: 10,
      offset: 0,
      processingStatus: ProcessingStatus.PROCESSING,
    });

    const args = prisma.recordedSet.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: 42, processingStatus: "PROCESSING" });
    expect(args.include.analysisResult.select).toEqual({
      outcome: true,
      analyzedAt: true,
      summaryFeedback: true,
    });
  });

  it("omits the exercise filter entirely when no code is supplied", async () => {
    prisma.recordedSet.findMany.mockResolvedValue([]);

    await list(10);

    expect(prisma.recordedSet.findMany.mock.calls[0][0].where).toEqual({
      userId: 42,
    });
  });

  it("pairs a look-ahead take with the requested offset and returns the shared shape", async () => {
    prisma.recordedSet.findMany.mockResolvedValue(rows(11));

    const result = await list(10, 20);

    expect(prisma.recordedSet.findMany.mock.calls[0][0]).toMatchObject({
      take: 11,
      skip: 20,
    });
    expect(result.items).toHaveLength(10);
    expect(result.page).toEqual({
      limit: 10,
      offset: 20,
      hasMore: true,
      nextOffset: 30,
    });
  });
});
