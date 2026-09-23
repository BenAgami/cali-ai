import { getPrismaClient } from "@repo/db";

import NotFoundError from "../../../src/errors/NotFoundError";
import BadRequestError from "../../../src/errors/BadRequestError";

import {
  asPrismaClient,
  createPrismaMock,
  type PrismaMock,
} from "../helpers/prismaMock";

vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));

const { WorkoutService } = await import("../../../src/services/workoutService");

const USER_UUID = "uuid-1";
const WORKOUT_ID = 5;

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
let workoutService: InstanceType<typeof WorkoutService>;

beforeEach(() => {
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  workoutService = new WorkoutService();
});

describe("WorkoutService propagates getUserIdByUuid failures", () => {
  it.for<[string, () => Promise<unknown>]>([
    [
      "listWorkouts",
      () =>
        workoutService.listWorkouts({
          userUuid: USER_UUID,
          limit: 10,
          offset: 0,
        }),
    ],
    [
      "getWorkoutById",
      () => workoutService.getWorkoutById(USER_UUID, WORKOUT_ID),
    ],
    [
      "createWorkout",
      () =>
        workoutService.createWorkout(USER_UUID, {
          name: "Push",
          exercises: [exerciseInput()],
        }),
    ],
    [
      "updateWorkout",
      () =>
        workoutService.updateWorkout(USER_UUID, WORKOUT_ID, { name: "Pull" }),
    ],
    [
      "deleteWorkout",
      () => workoutService.deleteWorkout(USER_UUID, WORKOUT_ID),
    ],
    [
      "startWorkoutLog",
      () =>
        workoutService.startWorkoutLog(USER_UUID, WORKOUT_ID, {
          durationSecs: 300,
        }),
    ],
  ])("%s rejects an unknown user uuid", async ([_name, call]) => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(call()).rejects.toThrow(new NotFoundError("User not found"));
  });
});

describe("WorkoutService validateExerciseInput", () => {
  const create = (exercises: Record<string, unknown>[]) =>
    workoutService.createWorkout(USER_UUID, {
      name: "Push",
      exercises: exercises as never,
    });

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.exercise.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.workout.create.mockResolvedValue({ id: WORKOUT_ID });
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

describe("WorkoutService assertExercisesExist", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.workout.create.mockResolvedValue({ id: WORKOUT_ID });
  });

  it("de-duplicates ids before querying and compares against the unique count", async () => {
    prisma.exercise.findMany.mockResolvedValue([{ id: 5 }, { id: 7 }]);

    await workoutService.createWorkout(USER_UUID, {
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
      workoutService.createWorkout(USER_UUID, {
        name: "Push",
        exercises: [
          exerciseInput({ exerciseId: 5 }),
          exerciseInput({ exerciseId: 7 }),
        ],
      }),
    ).rejects.toThrow(new NotFoundError("Exercise not found"));
  });
});

describe("WorkoutService.createWorkout", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.exercise.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    prisma.workout.create.mockResolvedValue({ id: WORKOUT_ID });
  });

  it("derives position from array order and normalizes undefined to null", async () => {
    await workoutService.createWorkout(USER_UUID, {
      name: "Push",
      exercises: [
        exerciseInput({ exerciseId: 2, reps: 10 }),
        exerciseInput({ exerciseId: 1, reps: undefined, durationSecs: 45 }),
      ],
    });

    expect(
      prisma.workout.create.mock.calls[0][0].data.exercises.create,
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

describe("WorkoutService.listWorkouts", () => {
  const list = (limit: number, offset = 0) =>
    workoutService.listWorkouts({ userUuid: USER_UUID, limit, offset });

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
  });

  it("pairs a look-ahead take with the requested offset", async () => {
    prisma.workout.findMany.mockResolvedValue([]);

    await list(10, 20);

    expect(prisma.workout.findMany.mock.calls[0][0]).toMatchObject({
      take: 11,
      skip: 20,
    });
  });

  it("returns the shared paginated shape, trimming the look-ahead row", async () => {
    prisma.workout.findMany.mockResolvedValue(rows(11));

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

describe("WorkoutService.getWorkoutById", () => {
  it("scopes the lookup to the owning user and throws when absent", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.workout.findFirst.mockResolvedValue(null);

    await expect(
      workoutService.getWorkoutById(USER_UUID, WORKOUT_ID),
    ).rejects.toThrow(new NotFoundError("Workout not found"));

    expect(prisma.workout.findFirst.mock.calls[0][0].where).toEqual({
      id: WORKOUT_ID,
      userId: 42,
    });
  });
});

describe("WorkoutService.updateWorkout", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.workout.findFirst.mockResolvedValue({ id: WORKOUT_ID });
    prisma.workout.findUnique.mockResolvedValue({ id: WORKOUT_ID });
    prisma.exercise.findMany.mockResolvedValue([{ id: 1 }]);
  });

  it("does not open a transaction when the workout is not owned", async () => {
    prisma.workout.findFirst.mockResolvedValue(null);

    await expect(
      workoutService.updateWorkout(USER_UUID, WORKOUT_ID, { name: "Pull" }),
    ).rejects.toThrow(new NotFoundError("Workout not found"));

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("leaves the exercise list untouched when none is supplied", async () => {
    await workoutService.updateWorkout(USER_UUID, WORKOUT_ID, { name: "Pull" });

    expect(prisma.exercise.findMany).not.toHaveBeenCalled();
    expect(prisma.workoutExercise.deleteMany).not.toHaveBeenCalled();
    expect(prisma.workoutExercise.createMany).not.toHaveBeenCalled();
  });

  it("leaves the name untouched when none is supplied", async () => {
    await workoutService.updateWorkout(USER_UUID, WORKOUT_ID, {
      exercises: [exerciseInput()],
    });

    expect(prisma.workout.update).not.toHaveBeenCalled();
  });

  it("replaces the exercise list by deleting the old rows first", async () => {
    await workoutService.updateWorkout(USER_UUID, WORKOUT_ID, {
      exercises: [exerciseInput(), exerciseInput({ reps: 8 })],
    });

    expect(prisma.workoutExercise.deleteMany).toHaveBeenCalledWith({
      where: { workoutId: WORKOUT_ID },
    });
  });

  it("repositions the replacement exercises from zero", async () => {
    await workoutService.updateWorkout(USER_UUID, WORKOUT_ID, {
      exercises: [exerciseInput(), exerciseInput(), exerciseInput()],
    });

    expect(
      prisma.workoutExercise.createMany.mock.calls[0][0].data.map(
        (row: { position: number }) => row.position,
      ),
    ).toEqual([0, 1, 2]);
  });

  it("throws when the workout disappears mid-transaction", async () => {
    prisma.workout.findUnique.mockResolvedValue(null);

    await expect(
      workoutService.updateWorkout(USER_UUID, WORKOUT_ID, { name: "Pull" }),
    ).rejects.toThrow(new NotFoundError("Workout not found"));
  });
});

describe("WorkoutService.deleteWorkout", () => {
  it("does not delete a workout the user does not own", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.workout.findFirst.mockResolvedValue(null);

    await expect(
      workoutService.deleteWorkout(USER_UUID, WORKOUT_ID),
    ).rejects.toThrow(new NotFoundError("Workout not found"));

    expect(prisma.workout.delete).not.toHaveBeenCalled();
  });
});

describe("WorkoutService.startWorkoutLog", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.workout.findFirst.mockResolvedValue({ id: WORKOUT_ID });
    prisma.workoutLog.create.mockResolvedValue({ id: 1 });
  });

  it("rejects an unowned workout without creating a log", async () => {
    prisma.workout.findFirst.mockResolvedValue(null);

    await expect(
      workoutService.startWorkoutLog(USER_UUID, WORKOUT_ID, {
        durationSecs: 300,
      }),
    ).rejects.toThrow(new NotFoundError("Workout not found"));

    expect(prisma.workoutLog.create).not.toHaveBeenCalled();
  });

  it("rejects an unparsable completedAt", async () => {
    await expect(
      workoutService.startWorkoutLog(USER_UUID, WORKOUT_ID, {
        durationSecs: 300,
        completedAt: "not-a-date",
      }),
    ).rejects.toThrow(new BadRequestError("Invalid completedAt value"));
  });

  it("passes a valid completedAt through as a Date", async () => {
    await workoutService.startWorkoutLog(USER_UUID, WORKOUT_ID, {
      durationSecs: 300,
      completedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(prisma.workoutLog.create.mock.calls[0][0].data.completedAt).toEqual(
      new Date("2026-01-01T00:00:00.000Z"),
    );
  });

  it("omits the completedAt key entirely when not supplied", async () => {
    await workoutService.startWorkoutLog(USER_UUID, WORKOUT_ID, {
      durationSecs: 300,
    });

    expect(prisma.workoutLog.create.mock.calls[0][0].data).not.toHaveProperty(
      "completedAt",
    );
  });
});
