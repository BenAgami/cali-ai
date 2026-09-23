import bcrypt from "bcrypt";
import { getPrismaClient, Role } from "@repo/db";

import { ConflictError, UnauthorizedError } from "../../../src/errors";
import generateJwtToken from "../../../src/utils/generateJwtToken";
import refreshTokenService from "../../../src/services/refreshTokenService";

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
vi.mock("bcrypt", () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
}));
vi.mock("../../../src/utils/generateJwtToken", () => ({
  default: vi.fn(() => "signed.jwt.token"),
}));
vi.mock("../../../src/services/refreshTokenService", () => ({
  default: {
    createRefreshToken: vi.fn(() => Promise.resolve("raw-refresh-token")),
    rotateRefreshToken: vi.fn(),
  },
}));

const { default: authService } =
  await import("../../../src/services/authService");

const createdUser = {
  id: 1,
  uuid: "uuid-1",
  email: "user@example.com",
  fullName: "Test User",
  username: "user1234",
  createdAt: new Date(),
  role: Role.USER,
};

const registerDto = {
  email: "user@example.com",
  password: "Password123!",
  name: "Test User",
};

let prisma: PrismaMock;

beforeEach(() => {
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
  vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
  vi.mocked(generateJwtToken).mockReturnValue("signed.jwt.token");
  vi.mocked(refreshTokenService.createRefreshToken).mockResolvedValue(
    "raw-refresh-token",
  );
});

describe("authService.register", () => {
  it("rejects a duplicate email without creating anything", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1 });

    await expect(authService.register(registerDto)).rejects.toThrow(
      new ConflictError("User with this email already exists"),
    );

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("normalizes the email before looking it up", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1 });

    await expect(
      authService.register({ ...registerDto, email: "  USER@Example.COM " }),
    ).rejects.toThrow(ConflictError);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
  });

  it("derives the base username from the normalized email local part", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(createdUser);

    await authService.register(registerDto);

    expect(prisma.user.create.mock.calls[0][0].data.username).toMatch(
      /^user\d{4}$/,
    );
  });

  it("retries with a fresh username when the first candidate is taken", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // email lookup
      .mockResolvedValueOnce({ id: 9 }) // first username taken
      .mockResolvedValueOnce(null); // second username free
    prisma.user.create.mockResolvedValue(createdUser);

    await authService.register(registerDto);

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(3);
    const attempted: string[] = prisma.user.findUnique.mock.calls
      .slice(1)
      .map((call) => call[0].where.username);
    expect(prisma.user.create.mock.calls[0][0].data.username).toBe(
      attempted[1],
    );
  });

  it("gives up after ten username collisions", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null); // email lookup
    for (let i = 0; i < 10; i++) {
      prisma.user.findUnique.mockResolvedValueOnce({ id: i });
    }

    await expect(authService.register(registerDto)).rejects.toThrow(
      new ConflictError(
        "Unable to generate a unique username. Please try again.",
      ),
    );

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(11);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("stores the bcrypt hash, never the plaintext password", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(createdUser);

    await authService.register(registerDto);

    expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data.password).toBe("hashed-password");
    expect(data.password).not.toBe(registerDto.password);
  });

  it("never selects the password column back out of the database", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(createdUser);

    await authService.register(registerDto);

    expect(prisma.user.create.mock.calls[0][0].select).not.toHaveProperty(
      "password",
    );
  });

  it("returns the user with a fresh access and refresh token", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(createdUser);

    const result = await authService.register(registerDto);

    expect(result).toEqual({
      user: createdUser,
      token: "signed.jwt.token",
      refreshToken: "raw-refresh-token",
    });
    expect(generateJwtToken).toHaveBeenCalledWith({
      uuid: createdUser.uuid,
      role: createdUser.role,
    });
    expect(refreshTokenService.createRefreshToken).toHaveBeenCalledWith(
      createdUser.id,
    );
  });

  describe("unique constraint mapping", () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null);
    });

    it("converts a P2002 on username into a ConflictError", async () => {
      // Only reachable by losing a race between the uniqueness check and the insert.
      prisma.user.create.mockRejectedValue(prismaError("P2002", ["username"]));

      await expect(authService.register(registerDto)).rejects.toThrow(
        new ConflictError("Username already taken"),
      );
    });

    it.for([
      ["the target is a different column", prismaError("P2002", ["email"])],
      ["the target is not an array", prismaError("P2002", "username")],
      ["the code is not P2002", prismaError("P2003", ["username"])],
      ["the error is not a Prisma error", new Error("network down")],
    ])("rethrows the original error when %s", async ([_label, error]) => {
      prisma.user.create.mockRejectedValue(error);

      await expect(authService.register(registerDto)).rejects.toBe(error);
    });
  });
});

describe("authService.login", () => {
  const loginDto = { email: "user@example.com", password: "Password123!" };
  const storedUser = { ...createdUser, password: "hashed-password" };

  it("does not compare passwords for an unknown email", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(authService.login(loginDto)).rejects.toThrow(
      new UnauthorizedError("Invalid email or password"),
    );

    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it("reports the identical message for an unknown user and a wrong password", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const unknownUser = await authService.login(loginDto).catch((e) => e);

    prisma.user.findUnique.mockResolvedValue(storedUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    const wrongPassword = await authService.login(loginDto).catch((e) => e);

    expect(unknownUser).toBeInstanceOf(UnauthorizedError);
    expect(wrongPassword).toBeInstanceOf(UnauthorizedError);
    expect(unknownUser.message).toBe(wrongPassword.message);
  });

  it("normalizes the email before looking it up", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      authService.login({ ...loginDto, email: " USER@Example.COM  " }),
    ).rejects.toThrow(UnauthorizedError);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
  });

  it("strips the password from the returned user", async () => {
    prisma.user.findUnique.mockResolvedValue(storedUser);

    const result = await authService.login(loginDto);

    expect(result.user).not.toHaveProperty("password");
    expect(result.token).toBe("signed.jwt.token");
    expect(result.refreshToken).toBe("raw-refresh-token");
  });
});

describe("authService.refresh", () => {
  beforeEach(() => {
    vi.mocked(refreshTokenService.rotateRefreshToken).mockResolvedValue({
      userId: 1,
      newRefreshToken: "rotated-refresh-token",
    });
  });

  it("delegates rotation to refreshTokenService", async () => {
    prisma.user.findUnique.mockResolvedValue({
      uuid: "uuid-1",
      role: Role.USER,
    });

    await authService.refresh("incoming-raw");

    expect(refreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
      "incoming-raw",
    );
  });

  it("rejects when the rotated token points at a user that no longer exists", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(authService.refresh("incoming-raw")).rejects.toThrow(
      new UnauthorizedError("Invalid refresh token"),
    );
  });

  it("issues an access token for the rotated user", async () => {
    prisma.user.findUnique.mockResolvedValue({
      uuid: "uuid-1",
      role: Role.ADMIN,
    });

    const result = await authService.refresh("incoming-raw");

    expect(generateJwtToken).toHaveBeenCalledWith({
      uuid: "uuid-1",
      role: Role.ADMIN,
    });
    expect(result).toEqual({
      token: "signed.jwt.token",
      refreshToken: "rotated-refresh-token",
    });
  });
});
