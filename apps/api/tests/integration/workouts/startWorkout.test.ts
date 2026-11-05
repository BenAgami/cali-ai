import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import type { getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { startWorkout } from "../helpers/requestSender/workoutsRequests";
import { createWorkoutFixture } from "../helpers/db/workoutHelper";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("POST /api/workouts/:id/logs", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should create a workout log linked to the workout", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;
    const dbUser = await prisma.user.findUnique({
      where: { email: registerUserDto.email!.toLowerCase() },
      select: { id: true },
    });

    const exercise = await createExercise(prisma);
    const workout = await createWorkoutFixture(prisma, {
      userId: dbUser!.id,
      name: "My Workout",
      exercises: [{ exerciseId: exercise.id, position: 0 }],
    });

    const response = await startWorkout(app, token, workout.id, {
      durationSecs: 1800,
    });

    expect(response.status).toBe(StatusCodes.CREATED);
    expect(typeof response.body.data.id).toBe("number");
    expect(response.body.data.workoutId).toBe(workout.id);
    expect(response.body.data.durationSecs).toBe(1800);

    const dbLog = await prisma.workoutLog.findUnique({
      where: { id: response.body.data.id },
    });
    expect(dbLog).not.toBeNull();
  });

  it("should accept optional completedAt", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;
    const dbUser = await prisma.user.findUnique({
      where: { email: registerUserDto.email!.toLowerCase() },
      select: { id: true },
    });

    const exercise = await createExercise(prisma);
    const workout = await createWorkoutFixture(prisma, {
      userId: dbUser!.id,
      name: "My Workout",
      exercises: [{ exerciseId: exercise.id, position: 0 }],
    });

    const completedAt = "2026-05-01T12:00:00.000Z";
    const response = await startWorkout(app, token, workout.id, {
      durationSecs: 1800,
      completedAt,
    });

    expect(response.status).toBe(StatusCodes.CREATED);
    expect(new Date(response.body.data.completedAt).toISOString()).toBe(
      completedAt,
    );
  });

  it("should return 404 for another user's workout", async () => {
    const userADto = new RegisterUserBuilder().build();
    await registerUser(app, userADto);
    const dbUserA = await prisma.user.findUnique({
      where: { email: userADto.email!.toLowerCase() },
      select: { id: true },
    });

    const userBDto = new RegisterUserBuilder().build();
    const userBRes = await registerUser(app, userBDto);
    const tokenB = userBRes.body.data.token;

    const exercise = await createExercise(prisma);
    const workout = await createWorkoutFixture(prisma, {
      userId: dbUserA!.id,
      name: "User A Workout",
      exercises: [{ exerciseId: exercise.id, position: 0 }],
    });

    const response = await startWorkout(app, tokenB, workout.id, {
      durationSecs: 1800,
    });

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("should return 404 for non-existent workout id", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const response = await startWorkout(app, token, 999999, {
      durationSecs: 1800,
    });

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("should return 401 without auth token", async () => {
    const response = await startWorkout(app, undefined, 1, {
      durationSecs: 1800,
    });

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("should return 400 for negative durationSecs", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;
    const dbUser = await prisma.user.findUnique({
      where: { email: registerUserDto.email!.toLowerCase() },
      select: { id: true },
    });

    const exercise = await createExercise(prisma);
    const workout = await createWorkoutFixture(prisma, {
      userId: dbUser!.id,
      name: "My Workout",
      exercises: [{ exerciseId: exercise.id, position: 0 }],
    });

    const response = await startWorkout(app, token, workout.id, {
      durationSecs: -5,
    });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });
});
