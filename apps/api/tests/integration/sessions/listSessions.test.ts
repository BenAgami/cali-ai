import { Application } from "express";
import { randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";

import { getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import {
  listWorkoutSessions,
  createWorkoutSession,
} from "../helpers/requestSender/sessionsRequests";
import { createExercise } from "../helpers/db/exerciseHelper";

import { WorkoutSessionBuilder } from "../builders/workoutSessionBuilder";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("GET /api/sessions", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should list workout sessions with pagination", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const exercise = await createExercise(prisma);
    const now = new Date();

    await createWorkoutSession(
      app,
      token,
      new WorkoutSessionBuilder()
        .setExerciseCode(exercise.code)
        .setPerformedAt(new Date(now.getTime() - 1000 * 60).toISOString())
        .build(),
    );
    await createWorkoutSession(
      app,
      token,
      new WorkoutSessionBuilder()
        .setExerciseCode(exercise.code)
        .setPerformedAt(new Date(now.getTime() - 1000 * 60 * 2).toISOString())
        .build(),
    );
    await createWorkoutSession(
      app,
      token,
      new WorkoutSessionBuilder()
        .setExerciseCode(exercise.code)
        .setPerformedAt(new Date(now.getTime() - 1000 * 60 * 3).toISOString())
        .build(),
    );

    const response = await listWorkoutSessions(app, token, {
      limit: 2,
      offset: 0,
    });

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.page.hasMore).toBe(true);
    expect(response.body.data.page.nextOffset).toBe(2);

    const firstPerformedAt = new Date(response.body.data.items[0].performedAt);
    const secondPerformedAt = new Date(response.body.data.items[1].performedAt);
    expect(firstPerformedAt.getTime()).toBeGreaterThanOrEqual(
      secondPerformedAt.getTime(),
    );
  });

  it("should return remaining sessions when using offset", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const exercise = await createExercise(prisma);
    const now = new Date();

    await createWorkoutSession(
      app,
      token,
      new WorkoutSessionBuilder()
        .setExerciseCode(exercise.code)
        .setPerformedAt(new Date(now.getTime() - 1000 * 60).toISOString())
        .build(),
    );
    await createWorkoutSession(
      app,
      token,
      new WorkoutSessionBuilder()
        .setExerciseCode(exercise.code)
        .setPerformedAt(new Date(now.getTime() - 1000 * 60 * 2).toISOString())
        .build(),
    );
    await createWorkoutSession(
      app,
      token,
      new WorkoutSessionBuilder()
        .setExerciseCode(exercise.code)
        .setPerformedAt(new Date(now.getTime() - 1000 * 60 * 3).toISOString())
        .build(),
    );

    const response = await listWorkoutSessions(app, token, {
      limit: 2,
      offset: 2,
    });

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.page.hasMore).toBe(false);
    expect(response.body.data.page.nextOffset).toBeNull();
  });

  it("should filter sessions by exerciseCode", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const exerciseCodeA = `push_up_${randomUUID().split("-")[0]}`;
    const exerciseCodeB = `squat_${randomUUID().split("-")[0]}`;
    const exerciseA = await createExercise(prisma, { code: exerciseCodeA });
    const exerciseB = await createExercise(prisma, { code: exerciseCodeB });

    await createWorkoutSession(
      app,
      token,
      new WorkoutSessionBuilder().setExerciseCode(exerciseA.code).build(),
    );
    await createWorkoutSession(
      app,
      token,
      new WorkoutSessionBuilder().setExerciseCode(exerciseB.code).build(),
    );

    const response = await listWorkoutSessions(app, token, {
      exerciseCode: exerciseCodeA,
    });

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].exercise.code).toBe(exerciseCodeA);
  });

  it("should return 401 if no token is provided", async () => {
    const response = await listWorkoutSessions(app, undefined);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(response.body.message).toBe(
      "Authorization header missing or malformed",
    );
  });

  it("should return 400 for invalid limit query", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const response = await listWorkoutSessions(app, token, {
      limit: 0,
    });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toContain("query.limit");
  });
});
