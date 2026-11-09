import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { ExerciseType, SessionStatus, type getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import {
  listWorkoutSessions,
  createWorkoutSession,
} from "../helpers/requestSender/workoutSessionsRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { grantAiPrerequisites } from "../helpers/db/aiPrerequisitesHelper";

import { WorkoutSessionBuilder } from "../builders/workoutSessionBuilder";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("GET /api/workout-sessions", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  const registerReadyUser = async () => {
    const dto = new RegisterUserBuilder().build();
    const res = await registerUser(app, dto);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: dto.email },
      select: { id: true },
    });
    await grantAiPrerequisites(prisma, user.id);
    return { token: res.body.data.token as string, userId: user.id };
  };

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
    for (const [code, displayName] of [
      ["push_up", "Push Up"],
      ["squat", "Squat"],
    ]) {
      await createExercise(prisma, {
        code,
        displayName,
        exerciseType: ExerciseType.DYNAMIC,
      });
    }
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should list workout sessions with pagination", async () => {
    const { token } = await registerReadyUser();

    const exercise = { code: "push_up" };
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
    const { token } = await registerReadyUser();

    const exercise = { code: "push_up" };
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
    const { token } = await registerReadyUser();

    const exerciseCodeA = "push_up";
    const exerciseCodeB = "squat";
    const exerciseA = { code: exerciseCodeA };
    const exerciseB = { code: exerciseCodeB };

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

  it("should filter by processingStatus and expose workout link, job id and no formScore", async () => {
    const { token, userId } = await registerReadyUser();
    const other = await registerReadyUser();
    const exercise = await prisma.exercise.findUniqueOrThrow({
      where: { code: "push_up" },
    });
    const workout = await prisma.workout.create({
      data: { userId, name: "W" },
    });

    const processing = await prisma.workoutSession.create({
      data: {
        userId,
        exerciseId: exercise.id,
        workoutId: workout.id,
        setNumber: 1,
        processingStatus: SessionStatus.PROCESSING,
        bullmqJobId: "analysis-1",
      },
    });
    const completed = await prisma.workoutSession.create({
      data: {
        userId,
        exerciseId: exercise.id,
        processingStatus: SessionStatus.COMPLETED,
      },
    });
    await prisma.workoutSession.create({
      data: {
        userId: other.userId,
        exerciseId: exercise.id,
        processingStatus: SessionStatus.PROCESSING,
      },
    });
    await prisma.analysisResult.create({
      data: {
        sessionId: completed.id,
        outcome: "SCORED",
        formScore: 88,
        summaryFeedback: "Nice",
      },
    });

    const filtered = await listWorkoutSessions(app, token, {
      processingStatus: "PROCESSING",
    });

    expect(filtered.status).toBe(StatusCodes.OK);
    expect(filtered.body.data.items).toHaveLength(1);
    expect(filtered.body.data.items[0]).toMatchObject({
      id: processing.id,
      workoutId: workout.id,
      setNumber: 1,
      bullmqJobId: "analysis-1",
      analysisResult: null,
    });

    const all = await listWorkoutSessions(app, token);
    const completedItem = all.body.data.items.find(
      (item: { id: number }) => item.id === completed.id,
    );
    expect(completedItem.analysisResult).toMatchObject({
      outcome: "SCORED",
      summaryFeedback: "Nice",
    });
    expect(JSON.stringify(all.body)).not.toContain("formScore");
  });

  it("should return 400 for an invalid processingStatus", async () => {
    const { token } = await registerReadyUser();

    const response = await listWorkoutSessions(app, token, {
      processingStatus: "BOGUS",
    });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("should return 401 if no token is provided", async () => {
    const response = await listWorkoutSessions(app, undefined);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(response.body.message).toBe(
      "Authorization header missing or malformed",
    );
  });

  it("should return 400 for invalid limit query", async () => {
    const { token } = await registerReadyUser();

    const response = await listWorkoutSessions(app, token, {
      limit: 0,
    });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toContain("query.limit");
  });
});
