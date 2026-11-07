import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import type { getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { deleteWorkout } from "../helpers/requestSender/workoutsRequests";
import { createWorkoutFixture } from "../helpers/db/workoutHelper";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("DELETE /api/workouts/:id", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should delete the workout and cascade workout_exercises", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;
    const dbUser = await prisma.user.findUnique({
      where: { email: registerUserDto.email!.toLowerCase() },
      select: { id: true },
    });

    const ex1 = await createExercise(prisma);
    const ex2 = await createExercise(prisma);

    const workout = await createWorkoutFixture(prisma, {
      userId: dbUser!.id,
      name: "To Delete",
      exercises: [
        { exerciseId: ex1.id, position: 0 },
        { exerciseId: ex2.id, position: 1 },
      ],
    });

    const response = await deleteWorkout(app, token, workout.id);

    expect(response.status).toBe(StatusCodes.NO_CONTENT);

    const deletedWorkout = await prisma.workout.findUnique({
      where: { id: workout.id },
    });
    expect(deletedWorkout).toBeNull();

    const exerciseCount = await prisma.workoutExercise.count({
      where: { workoutId: workout.id },
    });
    expect(exerciseCount).toBe(0);
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

    const response = await deleteWorkout(app, tokenB, workout.id);

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("should return 404 for non-existent id", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const response = await deleteWorkout(app, token, 999999);

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("should return 401 without auth token", async () => {
    const response = await deleteWorkout(app, undefined, 1);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
