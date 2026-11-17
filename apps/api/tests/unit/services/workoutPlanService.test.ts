import { getPrismaClient, ProcessingStatus } from "@repo/db";
import { API_ERROR_CODES } from "@repo/common";

import {
  NotFoundError,
  BadRequestError,
  ConflictError,
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

const { WorkoutPlanService } =
  await import("../../../src/services/workoutPlanService");

const USER_UUID = "uuid-1";
const WORKOUT_PLAN_ID = 5;
const RUN_ID = 11;

const exerciseInput = (overrides: Record<string, unknown> = {}) => ({
  exerciseId: 1,
  sets: 3,
  reps: 10,
  restSecs: 60,
  ...overrides,
});

const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: i + 1 }));

let prisma: PrismaMock;
let workoutPlanService: InstanceType<typeof WorkoutPlanService>;

beforeEach(() => {
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  workoutPlanService = new WorkoutPlanService();
});

describe("WorkoutPlanService propagates getUserIdByUuid failures", () => {
  it.for<[string, () => Promise<unknown>]>([
    [
      "listWorkoutPlans",
      () =>
        workoutPlanService.listWorkoutPlans({
          userUuid: USER_UUID,
          limit: 10,
          offset: 0,
        }),
    ],
    [
      "getWorkoutPlanById",
      () => workoutPlanService.getWorkoutPlanById(USER_UUID, WORKOUT_PLAN_ID),
    ],
    [
      "createWorkoutPlan",
      () =>
        workoutPlanService.createWorkoutPlan(USER_UUID, {
          name: "Push",
          exercises: [exerciseInput()],
        }),
    ],
    [
      "updateWorkoutPlan",
      () =>
        workoutPlanService.updateWorkoutPlan(USER_UUID, WORKOUT_PLAN_ID, {
          name: "Pull",
        }),
    ],
    [
      "deleteWorkoutPlan",
      () => workoutPlanService.deleteWorkoutPlan(USER_UUID, WORKOUT_PLAN_ID),
    ],
    [
      "startWorkoutRun",
      () => workoutPlanService.startWorkoutRun(USER_UUID, WORKOUT_PLAN_ID),
    ],
    [
      "completeWorkoutRun",
      () =>
        workoutPlanService.completeWorkoutRun(
          USER_UUID,
          WORKOUT_PLAN_ID,
          RUN_ID,
        ),
    ],
  ])("%s rejects an unknown user uuid", async ([_name, call]) => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(call()).rejects.toThrow(new NotFoundError("User not found"));
  });
});

describe("WorkoutPlanService validateExerciseInput", () => {
  const create = (exercises: Record<string, unknown>[]) =>
    workoutPlanService.createWorkoutPlan(USER_UUID, {
      name: "Push",
      exercises: exercises as never,
    });

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.exercise.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.workoutPlan.create.mockResolvedValue({ id: WORKOUT_PLAN_ID });
  });

  it("rejects an exercise specifying both reps and durationSecs", async () => {
    await expect(
      create([exerciseInput({ reps: 10, durationSecs: 30 })]),
    ).rejects.toThrow(
      new BadRequestError("Cannot specify both reps and durationSecs"),
    );
  });

  it.for<[string, Record<string, unknown>]>([
    ["neither is present", { reps: undefined, durationSecs: undefined }],
    ["both are explicitly null", { reps: null, durationSecs: null }],
    ["reps is zero", { reps: 0, durationSecs: undefined }],
    ["durationSecs is zero", { reps: undefined, durationSecs: 0 }],
  ])("rejects an exercise where %s", async ([_label, overrides]) => {
    await expect(create([exerciseInput(overrides)])).rejects.toThrow(
      new BadRequestError("Either reps or durationSecs must be specified"),
    );
  });

  it("validates before checking that the exercises exist", async () => {
    await expect(
      create([exerciseInput({ reps: 10, durationSecs: 30 })]),
    ).rejects.toThrow(BadRequestError);

    expect(prisma.exercise.findMany).not.toHaveBeenCalled();
  });
});

describe("WorkoutPlanService assertExercisesExist", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.workoutPlan.create.mockResolvedValue({ id: WORKOUT_PLAN_ID });
  });

  it("de-duplicates ids before querying and compares against the unique count", async () => {
    prisma.exercise.findMany.mockResolvedValue([{ id: 5 }, { id: 7 }]);

    await workoutPlanService.createWorkoutPlan(USER_UUID, {
      name: "Push",
      exercises: [
        exerciseInput({ exerciseId: 5 }),
        exerciseInput({ exerciseId: 5 }),
        exerciseInput({ exerciseId: 7 }),
      ],
    });

    expect(prisma.exercise.findMany).toHaveBeenCalledWith({
      where: { id: { in: [5, 7] } },
      select: { id: true },
    });
  });

  it("rejects when fewer rows come back than unique ids requested", async () => {
    prisma.exercise.findMany.mockResolvedValue([{ id: 5 }]);

    await expect(
      workoutPlanService.createWorkoutPlan(USER_UUID, {
        name: "Push",
        exercises: [
          exerciseInput({ exerciseId: 5 }),
          exerciseInput({ exerciseId: 7 }),
        ],
      }),
    ).rejects.toThrow(new NotFoundError("Exercise not found"));
  });
});

describe("WorkoutPlanService.createWorkoutPlan", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.exercise.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    prisma.workoutPlan.create.mockResolvedValue({ id: WORKOUT_PLAN_ID });
  });

  it("derives position from array order and normalizes undefined to null", async () => {
    await workoutPlanService.createWorkoutPlan(USER_UUID, {
      name: "Push",
      exercises: [
        exerciseInput({ exerciseId: 2, reps: 10 }),
        exerciseInput({ exerciseId: 1, reps: undefined, durationSecs: 45 }),
      ],
    });

    expect(
      prisma.workoutPlan.create.mock.calls[0][0].data.exercises.create,
    ).toEqual([
      {
        exerciseId: 2,
        position: 0,
        sets: 3,
        reps: 10,
        durationSecs: null,
        restSecs: 60,
      },
      {
        exerciseId: 1,
        position: 1,
        sets: 3,
        reps: null,
        durationSecs: 45,
        restSecs: 60,
      },
    ]);
  });
});

describe("WorkoutPlanService.createWorkoutPlan provenance", () => {
  const save = (generationId?: number) =>
    workoutPlanService.createWorkoutPlan(USER_UUID, {
      name: "Push",
      exercises: [exerciseInput()],
      ...(generationId === undefined ? {} : { generationId }),
    });

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.exercise.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.workoutPlan.create.mockResolvedValue({ id: WORKOUT_PLAN_ID });
  });

  it("omits aiModel and generationId for a manual workout", async () => {
    await save();

    expect(prisma.workoutGeneration.findFirst).not.toHaveBeenCalled();
    const data = prisma.workoutPlan.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("aiModel");
    expect(data).not.toHaveProperty("generationId");
  });

  it("stores the model and link from an owned succeeded generation", async () => {
    prisma.workoutGeneration.findFirst.mockResolvedValue({
      id: 12,
      model: "claude-haiku-5-5",
    });

    await save(12);

    expect(prisma.workoutGeneration.findFirst).toHaveBeenCalledWith({
      where: { id: 12, userId: 42, status: "SUCCEEDED" },
      select: { id: true, model: true },
    });
    expect(prisma.workoutPlan.create.mock.calls[0][0].data).toMatchObject({
      aiModel: "claude-haiku-5-5",
      generationId: 12,
    });
  });

  it.for<[string, unknown]>([
    ["is not found", null],
    ["has no model", { id: 12, model: null }],
  ])("rejects when the generation %s", async ([_label, row]) => {
    prisma.workoutGeneration.findFirst.mockResolvedValue(row);

    await expect(save(12)).rejects.toThrow(
      new NotFoundError("Generation not found"),
    );
    expect(prisma.workoutPlan.create).not.toHaveBeenCalled();
  });

  it("maps a unique violation to GENERATION_ALREADY_SAVED", async () => {
    prisma.workoutGeneration.findFirst.mockResolvedValue({
      id: 12,
      model: "claude-haiku-5-5",
    });
    prisma.workoutPlan.create.mockRejectedValue({ code: "P2002" });

    await expect(save(12)).rejects.toThrow(
      new ConflictError(
        "This generated workout was already saved",
        "GENERATION_ALREADY_SAVED",
      ),
    );
  });

  it("rethrows other create failures", async () => {
    prisma.workoutPlan.create.mockRejectedValue(new Error("boom"));

    await expect(save()).rejects.toThrow("boom");
  });

  it("never touches aiModel or generationId on update", async () => {
    prisma.workoutPlan.findFirst.mockResolvedValue({ id: WORKOUT_PLAN_ID });
    prisma.workoutPlan.findUnique.mockResolvedValue({ id: WORKOUT_PLAN_ID });

    await workoutPlanService.updateWorkoutPlan(USER_UUID, WORKOUT_PLAN_ID, {
      name: "Pull",
    });

    const data = prisma.workoutPlan.update.mock.calls[0][0].data;
    expect(data).toEqual({ name: "Pull" });
  });
});

describe("WorkoutPlanService.listWorkoutPlans", () => {
  const list = (limit: number, offset = 0) =>
    workoutPlanService.listWorkoutPlans({ userUuid: USER_UUID, limit, offset });

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
  });

  it("pairs a look-ahead take with the requested offset", async () => {
    prisma.workoutPlan.findMany.mockResolvedValue([]);

    await list(10, 20);

    expect(prisma.workoutPlan.findMany.mock.calls[0][0]).toMatchObject({
      take: 11,
      skip: 20,
    });
  });

  it("returns the shared paginated shape, trimming the look-ahead row", async () => {
    prisma.workoutPlan.findMany.mockResolvedValue(rows(11));

    const result = await list(10, 20);

    expect(result.items).toHaveLength(10);
    expect(result.page).toEqual({
      limit: 10,
      offset: 20,
      hasMore: true,
      nextOffset: 30,
    });
  });
});

describe("WorkoutPlanService.getWorkoutPlanById", () => {
  it("scopes the lookup to the owning user and throws when absent", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.workoutPlan.findFirst.mockResolvedValue(null);

    await expect(
      workoutPlanService.getWorkoutPlanById(USER_UUID, WORKOUT_PLAN_ID),
    ).rejects.toThrow(new NotFoundError("Workout not found"));

    expect(prisma.workoutPlan.findFirst.mock.calls[0][0].where).toEqual({
      id: WORKOUT_PLAN_ID,
      userId: 42,
    });
  });
});

describe("WorkoutPlanService.updateWorkoutPlan", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.workoutPlan.findFirst.mockResolvedValue({ id: WORKOUT_PLAN_ID });
    prisma.workoutPlan.findUnique.mockResolvedValue({ id: WORKOUT_PLAN_ID });
    prisma.exercise.findMany.mockResolvedValue([{ id: 1 }]);
  });

  it("does not open a transaction when the workout is not owned", async () => {
    prisma.workoutPlan.findFirst.mockResolvedValue(null);

    await expect(
      workoutPlanService.updateWorkoutPlan(USER_UUID, WORKOUT_PLAN_ID, {
        name: "Pull",
      }),
    ).rejects.toThrow(new NotFoundError("Workout not found"));

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("leaves the exercise list untouched when none is supplied", async () => {
    await workoutPlanService.updateWorkoutPlan(USER_UUID, WORKOUT_PLAN_ID, {
      name: "Pull",
    });

    expect(prisma.exercise.findMany).not.toHaveBeenCalled();
    expect(prisma.workoutExercise.deleteMany).not.toHaveBeenCalled();
    expect(prisma.workoutExercise.createMany).not.toHaveBeenCalled();
  });

  it("leaves the name untouched when none is supplied", async () => {
    await workoutPlanService.updateWorkoutPlan(USER_UUID, WORKOUT_PLAN_ID, {
      exercises: [exerciseInput()],
    });

    expect(prisma.workoutPlan.update).not.toHaveBeenCalled();
  });

  it("replaces the exercise list by deleting the old rows first", async () => {
    await workoutPlanService.updateWorkoutPlan(USER_UUID, WORKOUT_PLAN_ID, {
      exercises: [exerciseInput(), exerciseInput({ reps: 8 })],
    });

    expect(prisma.workoutExercise.deleteMany).toHaveBeenCalledWith({
      where: { workoutPlanId: WORKOUT_PLAN_ID },
    });
  });

  it("repositions the replacement exercises from zero", async () => {
    await workoutPlanService.updateWorkoutPlan(USER_UUID, WORKOUT_PLAN_ID, {
      exercises: [exerciseInput(), exerciseInput(), exerciseInput()],
    });

    expect(
      prisma.workoutExercise.createMany.mock.calls[0][0].data.map(
        (row: { position: number }) => row.position,
      ),
    ).toEqual([0, 1, 2]);
  });

  it("throws when the workout disappears mid-transaction", async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue(null);

    await expect(
      workoutPlanService.updateWorkoutPlan(USER_UUID, WORKOUT_PLAN_ID, {
        name: "Pull",
      }),
    ).rejects.toThrow(new NotFoundError("Workout not found"));
  });
});

describe("WorkoutPlanService.deleteWorkoutPlan", () => {
  it("does not delete a workout the user does not own", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.workoutPlan.findFirst.mockResolvedValue(null);

    await expect(
      workoutPlanService.deleteWorkoutPlan(USER_UUID, WORKOUT_PLAN_ID),
    ).rejects.toThrow(new NotFoundError("Workout not found"));

    expect(prisma.workoutPlan.delete).not.toHaveBeenCalled();
  });
});

describe("WorkoutPlanService.startWorkoutRun", () => {
  const NOW = new Date("2026-11-12T10:00:00.000Z");
  const RESUME_CUTOFF = new Date("2026-11-12T07:00:00.000Z");
  const OPEN_RUN = {
    userId: 42,
    workoutPlanId: WORKOUT_PLAN_ID,
    completedAt: null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.workoutPlan.findFirst.mockResolvedValue({ id: WORKOUT_PLAN_ID });
    prisma.workoutRun.deleteMany.mockResolvedValue({ count: 0 });
    prisma.workoutRun.findFirst.mockResolvedValue(null);
    prisma.workoutRun.create.mockResolvedValue({ id: RUN_ID });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deletes open runs older than 3 hours whose recorded sets are all PENDING", async () => {
    await workoutPlanService.startWorkoutRun(USER_UUID, WORKOUT_PLAN_ID);

    expect(prisma.workoutRun.deleteMany).toHaveBeenCalledWith({
      where: {
        ...OPEN_RUN,
        startedAt: { lt: RESUME_CUTOFF },
        recordedSets: {
          none: { processingStatus: { not: ProcessingStatus.PENDING } },
        },
      },
    });
  });

  it("creates an in-progress run when no recent run is open", async () => {
    const result = await workoutPlanService.startWorkoutRun(
      USER_UUID,
      WORKOUT_PLAN_ID,
    );

    expect(prisma.workoutRun.findFirst).toHaveBeenCalledWith({
      where: { ...OPEN_RUN, startedAt: { gte: RESUME_CUTOFF } },
      orderBy: { startedAt: "desc" },
    });
    expect(prisma.workoutRun.create).toHaveBeenCalledWith({
      data: { userId: 42, workoutPlanId: WORKOUT_PLAN_ID },
    });
    expect(result).toEqual({ id: RUN_ID });
  });

  it("resumes the open run started within 3 hours", async () => {
    prisma.workoutRun.findFirst.mockResolvedValue({ id: 77 });

    const result = await workoutPlanService.startWorkoutRun(
      USER_UUID,
      WORKOUT_PLAN_ID,
    );

    expect(result).toEqual({ id: 77 });
    expect(prisma.workoutRun.create).not.toHaveBeenCalled();
  });
});

describe("WorkoutPlanService.completeWorkoutRun", () => {
  const STARTED_AT = new Date("2026-11-12T09:30:00.000Z");

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.workoutRun.findFirst.mockResolvedValue({
      startedAt: STARTED_AT,
      completedAt: null,
    });
    prisma.workoutRun.updateMany.mockResolvedValue({ count: 1 });
    prisma.workoutRun.findUniqueOrThrow.mockResolvedValue({ id: RUN_ID });
  });

  it("looks the run up by owner, workout and id", async () => {
    await workoutPlanService.completeWorkoutRun(
      USER_UUID,
      WORKOUT_PLAN_ID,
      RUN_ID,
    );

    expect(prisma.workoutRun.findFirst).toHaveBeenCalledWith({
      where: { id: RUN_ID, workoutPlanId: WORKOUT_PLAN_ID, userId: 42 },
      select: { startedAt: true, completedAt: true },
    });
  });

  it("stamps completedAt and derives the duration from startedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T10:00:00.000Z"));
    try {
      await workoutPlanService.completeWorkoutRun(
        USER_UUID,
        WORKOUT_PLAN_ID,
        RUN_ID,
      );

      expect(prisma.workoutRun.updateMany).toHaveBeenCalledWith({
        where: { id: RUN_ID, completedAt: null },
        data: {
          completedAt: new Date("2026-11-12T10:00:00.000Z"),
          durationSecs: 1800,
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects with a conflict when another request completed it first", async () => {
    prisma.workoutRun.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      workoutPlanService.completeWorkoutRun(USER_UUID, WORKOUT_PLAN_ID, RUN_ID),
    ).rejects.toMatchObject({
      message: "Workout run is already completed",
      code: API_ERROR_CODES.WORKOUT_RUN_COMPLETED,
    });
    expect(prisma.workoutRun.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("rejects an already completed run with the completed-run code", async () => {
    prisma.workoutRun.findFirst.mockResolvedValue({
      startedAt: STARTED_AT,
      completedAt: new Date("2026-11-12T09:45:00.000Z"),
    });

    const result = workoutPlanService.completeWorkoutRun(
      USER_UUID,
      WORKOUT_PLAN_ID,
      RUN_ID,
    );

    await expect(result).rejects.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toMatchObject({
      code: API_ERROR_CODES.WORKOUT_RUN_COMPLETED,
    });
    expect(prisma.workoutRun.updateMany).not.toHaveBeenCalled();
  });
});
