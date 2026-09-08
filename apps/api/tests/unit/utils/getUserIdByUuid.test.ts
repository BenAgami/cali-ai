import NotFoundError from "../../../src/errors/NotFoundError";
import { getUserIdByUuid } from "../../../src/utils/getUserIdByUuid";

import {
  asPrismaClient,
  createPrismaMock,
  type PrismaMock,
} from "../helpers/prismaMock";

let prisma: PrismaMock;

beforeEach(() => {
  prisma = createPrismaMock();
});

describe("getUserIdByUuid", () => {
  it("resolves the numeric id for a known uuid", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });

    await expect(
      getUserIdByUuid(asPrismaClient(prisma), "uuid-1"),
    ).resolves.toBe(42);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { uuid: "uuid-1" },
      select: { id: true },
    });
  });

  it("throws when no user matches", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      getUserIdByUuid(asPrismaClient(prisma), "uuid-1"),
    ).rejects.toThrow(new NotFoundError("User not found"));
  });
});
