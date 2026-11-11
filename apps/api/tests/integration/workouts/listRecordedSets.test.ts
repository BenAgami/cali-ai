import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { type getPrismaClient, SessionStatus } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { getRecordedSets } from "../helpers/requestSender/workoutsRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { createWorkoutFixture } from "../helpers/db/workoutHelper";

import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("GET /api/workouts/:id/recorded-sets", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;
  let exerciseId: number;

  const newUser = async () => {
    const dto = new RegisterUserBuilder().build();
    const res = await registerUser(app, dto);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: dto.email },
      select: { id: true },
    });
    return { userId: user.id, token: res.body.data.token as string };
  };

  const newWorkout = (userId: number) =>
    createWorkoutFixture(prisma, {
      userId,
      exercises: [{ exerciseId, position: 1 }],
    });

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
    exerciseId = (await createExercise(prisma, { code: "push_up" })).id;
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("lists recorded sets newest first with status, outcome and band, without formScore", async () => {
    const { userId, token } = await newUser();
    const workout = await newWorkout(userId);
    const older = await prisma.workoutSession.create({
      data: {
        userId,
        exerciseId,
        workoutId: workout.id,
        setNumber: 1,
        performedAt: new Date("2026-11-09T10:00:00Z"),
        processingStatus: SessionStatus.COMPLETED,
        analysisResult: {
          create: { outcome: "SCORED", formScore: 91 },
        },
      },
      select: { id: true },
    });
    const newer = await prisma.workoutSession.create({
      data: {
        userId,
        exerciseId,
        workoutId: workout.id,
        setNumber: 2,
        performedAt: new Date("2026-11-09T10:05:00Z"),
        processingStatus: SessionStatus.PROCESSING,
        analysisStage: "ANALYZING_REPS",
      },
      select: { id: true },
    });

    const response = await getRecordedSets(app, token, workout.id);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toMatchObject({
      sessionId: newer.id,
      processingStatus: "PROCESSING",
      analysisStage: "ANALYZING_REPS",
      outcome: null,
      band: null,
    });
    expect(response.body.data[1]).toMatchObject({
      sessionId: older.id,
      outcome: "SCORED",
      band: "EXCELLENT",
    });
    expect(JSON.stringify(response.body)).not.toContain("formScore");
  });

  it("returns an empty list for a workout with no recorded sets", async () => {
    const { userId, token } = await newUser();
    const workout = await newWorkout(userId);

    const response = await getRecordedSets(app, token, workout.id);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data).toEqual([]);
  });

  it("returns 404 for another user's workout", async () => {
    const owner = await newUser();
    const other = await newUser();
    const workout = await newWorkout(owner.userId);

    const response = await getRecordedSets(app, other.token, workout.id);

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("returns 401 without a token", async () => {
    const response = await getRecordedSets(app, undefined, 1);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
