import { getPrismaClient } from "@repo/db";

import { NotFoundError } from "../../../src/errors";

import {
  asPrismaClient,
  createPrismaMock,
  type PrismaMock,
} from "../helpers/prismaMock";

vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));

const { ExerciseService } =
  await import("../../../src/services/exerciseService");

const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: i + 1, code: `ex_${i}` }));

let prisma: PrismaMock;
let exerciseService: InstanceType<typeof ExerciseService>;

beforeEach(() => {
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  exerciseService = new ExerciseService();
});

describe("ExerciseService.listExercises", () => {
  const list = (limit: number, offset = 0, includeInactive = false) =>
    exerciseService.listExercises({ limit, offset, includeInactive });

  it("filters to active exercises by default", async () => {
    prisma.exercise.findMany.mockResolvedValue([]);

    await list(10);

    expect(prisma.exercise.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
    });
  });

  it("drops the isActive filter when inactive rows are requested", async () => {
    prisma.exercise.findMany.mockResolvedValue([]);

    await list(10, 0, true);

    expect(prisma.exercise.findMany.mock.calls[0][0].where).toEqual({});
  });

  it("pairs a look-ahead take with the requested offset", async () => {
    prisma.exercise.findMany.mockResolvedValue([]);

    await list(10, 20);

    expect(prisma.exercise.findMany.mock.calls[0][0]).toMatchObject({
      take: 11,
      skip: 20,
    });
  });

  it("returns the shared paginated shape, trimming the look-ahead row", async () => {
    prisma.exercise.findMany.mockResolvedValue(rows(11));

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

describe("ExerciseService.getExerciseByCode", () => {
  it("normalizes the code before querying", async () => {
    prisma.exercise.findFirst.mockResolvedValue({ id: 1 });

    await exerciseService.getExerciseByCode("  PUSH_UP ");

    expect(prisma.exercise.findFirst.mock.calls[0][0].where.code).toBe(
      "push_up",
    );
  });

  it("restricts to active exercises by default", async () => {
    prisma.exercise.findFirst.mockResolvedValue({ id: 1 });

    await exerciseService.getExerciseByCode("push_up");

    expect(prisma.exercise.findFirst.mock.calls[0][0].where).toEqual({
      code: "push_up",
      isActive: true,
    });
  });

  it("omits the isActive filter when inactive rows are allowed", async () => {
    prisma.exercise.findFirst.mockResolvedValue({ id: 1 });

    await exerciseService.getExerciseByCode("push_up", true);

    expect(prisma.exercise.findFirst.mock.calls[0][0].where).toEqual({
      code: "push_up",
    });
  });

  it("throws when no exercise matches", async () => {
    prisma.exercise.findFirst.mockResolvedValue(null);

    await expect(exerciseService.getExerciseByCode("push_up")).rejects.toThrow(
      new NotFoundError("Exercise not found"),
    );
  });
});
