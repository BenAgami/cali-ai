import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getPrismaClient } from "@repo/db";

import { ConflictError, NotFoundError } from "../../../src/errors";
import { env } from "../../../src/config/env";

import {
  asPrismaClient,
  createPrismaMock,
  prismaError,
  type PrismaMock,
} from "../helpers/prismaMock";

vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(() => Promise.resolve("https://r2.example.com/signed")),
}));
vi.mock("../../../src/lib/r2", () => ({ r2Client: {} }));

const { UserService } = await import("../../../src/services/userService");

let prisma: PrismaMock;
let userService: InstanceType<typeof UserService>;

beforeEach(() => {
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  vi.mocked(getSignedUrl).mockResolvedValue("https://r2.example.com/signed");
  userService = new UserService();
});

describe("UserService.getUserByUuid", () => {
  it("throws when no user matches", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(userService.getUserByUuid("uuid-1")).rejects.toThrow(
      new NotFoundError("User not found"),
    );
  });

  it("selects only the most recent active goal", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, goals: [] });

    await userService.getUserByUuid("uuid-1");

    expect(prisma.user.findUnique.mock.calls[0][0].select.goals).toMatchObject({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
  });
});

describe("UserService.getUserByEmail", () => {
  it("normalizes the email before looking it up", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1 });

    await userService.getUserByEmail("  USER@Example.COM ");

    expect(prisma.user.findUnique.mock.calls[0][0].where).toEqual({
      email: "user@example.com",
    });
  });

  it("throws when no user matches", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      userService.getUserByEmail("user@example.com"),
    ).rejects.toThrow(new NotFoundError("User not found"));
  });
});

describe("UserService.updateProfile", () => {
  const patchData = () => prisma.user.update.mock.calls[0][0].data;

  beforeEach(() => {
    prisma.user.update.mockResolvedValue({ uuid: "uuid-1" });
  });

  it.for([
    ["only a username", { username: "newname" }, { username: "newname" }],
    [
      "only an avatarUrl",
      { avatarUrl: "https://cdn/x.jpg" },
      { avatarUrl: "https://cdn/x.jpg" },
    ],
    [
      "every field",
      {
        username: "newname",
        avatarUrl: "https://cdn/x.jpg",
        experienceLevel: "BEGINNER",
      },
      {
        username: "newname",
        avatarUrl: "https://cdn/x.jpg",
        experienceLevel: "BEGINNER",
      },
    ],
    ["nothing", {}, {}],
  ])("builds a patch containing %s", async ([_label, input, expected]) => {
    await userService.updateProfile("uuid-1", input as never);

    expect(patchData()).toEqual(expected);
  });

  it("converts a unique constraint violation into a ConflictError", async () => {
    prisma.user.update.mockRejectedValue(prismaError("P2002"));

    await expect(
      userService.updateProfile("uuid-1", { username: "taken" }),
    ).rejects.toThrow(new ConflictError("Username already taken"));
  });

  it.for([
    ["a different Prisma error", prismaError("P2025")],
    ["a non-Prisma error", new Error("network down")],
  ])("rethrows %s unchanged", async ([_label, error]) => {
    prisma.user.update.mockRejectedValue(error);

    await expect(
      userService.updateProfile("uuid-1", { username: "x" }),
    ).rejects.toBe(error);
  });
});

describe("UserService.getAvatarUploadUrl", () => {
  it("namespaces the key by user uuid and timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const result = await userService.getAvatarUploadUrl("uuid-1");

    expect(result.key).toBe(`avatars/uuid-1/${Date.now()}.jpg`);
    vi.useRealTimers();
  });

  it("presigns the upload for five minutes", async () => {
    await userService.getAvatarUploadUrl("uuid-1");

    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 300 },
    );
  });

  it("builds a public URL with exactly one scheme", async () => {
    const { publicUrl, key } = await userService.getAvatarUploadUrl("uuid-1");

    expect(publicUrl).toBe(`https://${env.r2.publicDomain}/${key}`);
    expect(publicUrl.match(/https:\/\//g)).toHaveLength(1);
  });
});

describe("UserService.createGoal", () => {
  const goalDto = {
    goalType: "STRENGTH",
    title: "10 pull-ups",
    targetValue: 10,
    targetUnit: "reps",
  };

  it("rejects an unknown user without creating a goal", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      userService.createGoal("uuid-1", goalDto as never),
    ).rejects.toThrow(new NotFoundError("User not found"));

    expect(prisma.userGoal.create).not.toHaveBeenCalled();
  });

  it("creates the goal as ACTIVE against the resolved user id", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.userGoal.create.mockResolvedValue({ id: 1 });

    await userService.createGoal("uuid-1", goalDto as never);

    expect(prisma.userGoal.create.mock.calls[0][0].data).toMatchObject({
      userId: 42,
      status: "ACTIVE",
      ...goalDto,
    });
  });
});
