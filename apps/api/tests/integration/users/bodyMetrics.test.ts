import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import type { getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import {
  getMyUser,
  postMyBodyMetrics,
} from "../helpers/requestSender/usersRequests";
import { registerUser } from "../helpers/requestSender/authRequests";

import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("POST /api/users/me/body-metrics", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  const registerAndGetToken = async () => {
    const res = await registerUser(app, new RegisterUserBuilder().build());
    return res.body.data.token as string;
  };

  it("should return a null bodyMetric and consent for a fresh user", async () => {
    const token = await registerAndGetToken();

    const response = await getMyUser(app, token);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.bodyMetric).toBeNull();
    expect(response.body.data.experienceLevel).toBeNull();
    expect(response.body.data.aiConsentVersion).toBeNull();
  });

  it("should store the first submission and skip an unchanged one", async () => {
    const token = await registerAndGetToken();
    const me = await getMyUser(app, token);
    const userId = me.body.data.id as number;

    const first = await postMyBodyMetrics(
      app,
      { heightCm: 180, weightKg: 75 },
      token,
    );

    expect(first.status).toBe(StatusCodes.CREATED);
    expect(first.body.data.created).toBe(true);
    expect(first.body.data.bodyMetric.heightCm).toBe(180);
    expect(first.body.data.bodyMetric.weightKg).toBe(75);

    const second = await postMyBodyMetrics(
      app,
      { heightCm: 180, weightKg: 75 },
      token,
    );

    expect(second.status).toBe(StatusCodes.OK);
    expect(second.body.data.created).toBe(false);
    expect(await prisma.bodyMetric.count({ where: { userId } })).toBe(1);
  });

  it("should append a new row when a value changes and expose the latest", async () => {
    const token = await registerAndGetToken();
    const me = await getMyUser(app, token);
    const userId = me.body.data.id as number;

    await postMyBodyMetrics(app, { heightCm: 180, weightKg: 75 }, token);
    const changed = await postMyBodyMetrics(
      app,
      { heightCm: 180, weightKg: 76 },
      token,
    );

    expect(changed.status).toBe(StatusCodes.CREATED);
    expect(await prisma.bodyMetric.count({ where: { userId } })).toBe(2);

    const profile = await getMyUser(app, token);
    expect(profile.body.data.bodyMetric.weightKg).toBe(76);
  });

  it("should return 400 when weight is missing", async () => {
    const token = await registerAndGetToken();

    const response = await postMyBodyMetrics(app, { heightCm: 180 }, token);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("should return 400 when height is out of range", async () => {
    const token = await registerAndGetToken();

    const response = await postMyBodyMetrics(
      app,
      { heightCm: 50, weightKg: 75 },
      token,
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("should return 401 without a token", async () => {
    const response = await postMyBodyMetrics(app, {
      heightCm: 180,
      weightKg: 75,
    });

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
