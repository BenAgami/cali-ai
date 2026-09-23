import { getPrismaClient, SessionStatus } from "@repo/db";

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

const { WorkoutSessionService } =
  await import("../../../src/services/workoutSessionService");

const USER_UUID = "uuid-1";
const baseDto = { exerciseCode: "push_up" };

const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: i + 1 }));

let prisma: PrismaMock;
let workoutSessionService: InstanceType<typeof WorkoutSessionService>;

/** Resolves the private uuid → id lookup and the active-exercise lookup. */
const givenUserAndExercise = () => {
  prisma.user.findUnique.mockResolvedValue({ id: 42 });
  prisma.exercise.findFirst.mockResolvedValue({ id: 7, code: "push_up" });
  prisma.workoutSession.create.mockResolvedValue({ id: 1 });
};

const createData = () => prisma.workoutSession.create.mock.calls[0][0].data;

beforeEach(() => {
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  workoutSessionService = new WorkoutSessionService();
});

describe("WorkoutSessionService.createSession", () => {
  it("rejects an unknown user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      workoutSessionService.createSession(USER_UUID, baseDto),
    ).rejects.toThrow(new NotFoundError("User not found"));
    expect(prisma.workoutSession.create).not.toHaveBeenCalled();
  });

  it("normalizes the exercise code and requires the exercise to be active", async () => {
    givenUserAndExercise();

    await workoutSessionService.createSession(USER_UUID, {
      exerciseCode: "  PUSH_UP ",
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
      workoutSessionService.createSession(USER_UUID, baseDto),
    ).rejects.toThrow(new NotFoundError("Exercise not found"));
    expect(prisma.workoutSession.create).not.toHaveBeenCalled();
  });

  it("starts every session in the PENDING state", async () => {
    givenUserAndExercise();

    await workoutSessionService.createSession(USER_UUID, baseDto);

    expect(createData().processingStatus).toBe(SessionStatus.PENDING);
  });

  it("flattens videoMeta into individual columns", async () => {
    givenUserAndExercise();

    await workoutSessionService.createSession(USER_UUID, {
      ...baseDto,
      videoMeta: {
        durationSec: 12,
        fps: 30,
        width: 1920,
        height: 1080,
        sizeBytes: 5_000_000,
      },
    });

    expect(createData()).toMatchObject({
      videoDurationSec: 12,
      videoFps: 30,
      videoWidth: 1920,
      videoHeight: 1080,
      videoSizeBytes: 5_000_000,
    });
  });

  it("maps present video fields and nulls the rest of a partial videoMeta", async () => {
    givenUserAndExercise();

    await workoutSessionService.createSession(USER_UUID, {
      ...baseDto,
      videoMeta: { durationSec: 12, height: 1080 },
    });

    const data = createData();
    expect(data.videoDurationSec).toBe(12);
    expect(data.videoHeight).toBe(1080);
    expect(data.videoFps).toBeNull();
    expect(data.videoWidth).toBeNull();
    expect(data.videoSizeBytes).toBeNull();
  });

  it("rejects an unparseable performedAt", async () => {
    givenUserAndExercise();

    await expect(
      workoutSessionService.createSession(USER_UUID, {
        ...baseDto,
        performedAt: "garbage",
      }),
    ).rejects.toThrow(new BadRequestError("Invalid performedAt value"));
    expect(prisma.workoutSession.create).not.toHaveBeenCalled();
  });

  it("passes a valid performedAt through as a Date", async () => {
    givenUserAndExercise();

    await workoutSessionService.createSession(USER_UUID, {
      ...baseDto,
      performedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(createData().performedAt).toEqual(
      new Date("2026-01-01T00:00:00.000Z"),
    );
  });

  it("leaves performedAt undefined when omitted so the column default applies", async () => {
    givenUserAndExercise();

    await workoutSessionService.createSession(USER_UUID, baseDto);

    expect(createData().performedAt).toBeUndefined();
  });
});

describe("WorkoutSessionService.listSessions", () => {
  const list = (limit: number, offset = 0, exerciseCode?: string) =>
    workoutSessionService.listSessions({
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
    prisma.workoutSession.findMany.mockResolvedValue([]);

    await list(10, 0, "  PUSH_UP ");

    expect(prisma.workoutSession.findMany.mock.calls[0][0].where).toEqual({
      userId: 42,
      exercise: { code: "push_up" },
    });
  });

  it("omits the exercise filter entirely when no code is supplied", async () => {
    prisma.workoutSession.findMany.mockResolvedValue([]);

    await list(10);

    expect(prisma.workoutSession.findMany.mock.calls[0][0].where).toEqual({
      userId: 42,
    });
  });

  it("pairs a look-ahead take with the requested offset and returns the shared shape", async () => {
    prisma.workoutSession.findMany.mockResolvedValue(rows(11));

    const result = await list(10, 20);

    expect(prisma.workoutSession.findMany.mock.calls[0][0]).toMatchObject({
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
