import crypto from "crypto";
import ms from "ms";
import { getPrismaClient } from "@repo/db";

import UnauthorizedError from "../../../src/errors/UnauthorizedError";
import { env } from "../../../src/config/env";

import {
  asPrismaClient,
  createPrismaMock,
  type PrismaMock,
} from "../helpers/prismaMock";

vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));

const { RefreshTokenService } =
  await import("../../../src/services/refreshTokenService");

const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const NOW = new Date("2026-01-01T00:00:00.000Z");

/** Defaults to a live, unexpired token relative to whatever clock is in effect. */
const tokenRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  userId: 42,
  tokenHash: sha256("incoming-raw"),
  familyId: "family-1",
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  ...overrides,
});

let prisma: PrismaMock;
let refreshTokenService: InstanceType<typeof RefreshTokenService>;

beforeEach(() => {
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  refreshTokenService = new RefreshTokenService();
});

describe("refreshTokenService.createRefreshToken", () => {
  it("persists the sha256 of the token it returns, never the raw value", async () => {
    prisma.refreshToken.create.mockResolvedValue({});

    const raw = await refreshTokenService.createRefreshToken(42);
    const { data } = prisma.refreshToken.create.mock.calls[0][0];

    expect(data.tokenHash).toBe(sha256(raw));
    expect(data.tokenHash).not.toBe(raw);
    expect(data.userId).toBe(42);
  });

  it("reuses an explicit familyId without generating a new one", async () => {
    prisma.refreshToken.create.mockResolvedValue({});
    const randomUUID = vi.spyOn(crypto, "randomUUID");

    await refreshTokenService.createRefreshToken(42, "family-1");

    expect(prisma.refreshToken.create.mock.calls[0][0].data.familyId).toBe(
      "family-1",
    );
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it("generates a fresh familyId per call when none is given", async () => {
    prisma.refreshToken.create.mockResolvedValue({});

    await refreshTokenService.createRefreshToken(42);
    await refreshTokenService.createRefreshToken(42);

    const [first, second]: string[] = prisma.refreshToken.create.mock.calls.map(
      (call) => call[0].data.familyId,
    );

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(first).not.toBe(second);
  });

  it("sets expiresAt to now plus the configured refresh lifetime", async () => {
    // Pins the private getExpiresAt() without exporting it.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    prisma.refreshToken.create.mockResolvedValue({});

    await refreshTokenService.createRefreshToken(42);

    expect(prisma.refreshToken.create.mock.calls[0][0].data.expiresAt).toEqual(
      new Date(NOW.getTime() + ms(env.jwt.refreshExpiresIn)),
    );
    vi.useRealTimers();
  });
});

describe("refreshTokenService.rotateRefreshToken", () => {
  it("looks the token up by its sha256 hash", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(tokenRecord());
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    await refreshTokenService.rotateRefreshToken("incoming-raw");

    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: sha256("incoming-raw") },
    });
  });

  it("rejects an unknown token without mutating anything", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);

    await expect(
      refreshTokenService.rotateRefreshToken("nope"),
    ).rejects.toThrow(new UnauthorizedError("Invalid refresh token"));

    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("revokes the whole family when a revoked token is replayed", async () => {
    // Reuse detection: presenting an already-rotated token means the token was
    // stolen, so every descendant in the family is killed.
    prisma.refreshToken.findUnique.mockResolvedValue(
      tokenRecord({ revokedAt: new Date(Date.now() - 5000) }),
    );
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

    await expect(
      refreshTokenService.rotateRefreshToken("incoming-raw"),
    ).rejects.toThrow(new UnauthorizedError("Invalid refresh token"));

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: "family-1" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("rejects an expired token without revoking its family", async () => {
    // An expired token is not evidence of theft, so — unlike replay — it must
    // leave the rest of the family usable.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    prisma.refreshToken.findUnique.mockResolvedValue(
      tokenRecord({ expiresAt: new Date(NOW.getTime() - 1) }),
    );

    await expect(
      refreshTokenService.rotateRefreshToken("incoming-raw"),
    ).rejects.toThrow(new UnauthorizedError("Refresh token expired"));

    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("revokes the presented token and issues a successor in the same family", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(tokenRecord());
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await refreshTokenService.rotateRefreshToken("incoming-raw");

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create.mock.calls[0][0].data.familyId).toBe(
      "family-1",
    );
    expect(result.userId).toBe(42);
    expect(result.newRefreshToken).not.toBe("incoming-raw");
  });
});

describe("refreshTokenService.revokeToken", () => {
  it("revokes only the matching, not-yet-revoked token", async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await refreshTokenService.revokeToken("incoming-raw");

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: sha256("incoming-raw"), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
