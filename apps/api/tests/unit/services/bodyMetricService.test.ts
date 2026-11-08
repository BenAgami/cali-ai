import { getPrismaClient } from "@repo/db";

import {
  asPrismaClient,
  createPrismaMock,
  type PrismaMock,
} from "../helpers/prismaMock";

vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));

const { BodyMetricService } =
  await import("../../../src/services/bodyMetricService");

let prisma: PrismaMock;
let service: InstanceType<typeof BodyMetricService>;

const select = { heightCm: true, weightKg: true, createdAt: true };
const latest = (heightCm: number, weightKg: number) => ({
  heightCm,
  weightKg,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
});

beforeEach(() => {
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  prisma.user.findUnique.mockResolvedValue({ id: 7 });
  service = new BodyMetricService();
});

describe("BodyMetricService.getLatest", () => {
  it("queries the newest row for the user", async () => {
    prisma.bodyMetric.findFirst.mockResolvedValue(null);

    const result = await service.getLatest(7);

    expect(result).toBeNull();
    expect(prisma.bodyMetric.findFirst).toHaveBeenCalledWith({
      where: { userId: 7 },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select,
    });
  });
});

describe("BodyMetricService.saveIfChanged", () => {
  it("creates a rounded row when none exists", async () => {
    prisma.bodyMetric.findFirst.mockResolvedValue(null);
    prisma.bodyMetric.create.mockResolvedValue(latest(180, 75.1));

    const result = await service.saveIfChanged("uuid-1", {
      heightCm: 180.04,
      weightKg: 75.06,
    });

    expect(prisma.bodyMetric.create).toHaveBeenCalledWith({
      data: { userId: 7, heightCm: 180, weightKg: 75.1 },
      select,
    });
    expect(result.created).toBe(true);
  });

  it("skips the insert when the rounded values match the latest row", async () => {
    const existing = latest(180, 75);
    prisma.bodyMetric.findFirst.mockResolvedValue(existing);

    const result = await service.saveIfChanged("uuid-1", {
      heightCm: 180.02,
      weightKg: 74.98,
    });

    expect(prisma.bodyMetric.create).not.toHaveBeenCalled();
    expect(result).toEqual({ bodyMetric: existing, created: false });
  });

  it("creates a row when only the weight changed", async () => {
    prisma.bodyMetric.findFirst.mockResolvedValue(latest(180, 75));
    prisma.bodyMetric.create.mockResolvedValue(latest(180, 76));

    const result = await service.saveIfChanged("uuid-1", {
      heightCm: 180,
      weightKg: 76,
    });

    expect(prisma.bodyMetric.create).toHaveBeenCalledTimes(1);
    expect(result.created).toBe(true);
  });
});
