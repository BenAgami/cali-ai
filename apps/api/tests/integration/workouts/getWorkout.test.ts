import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import type { getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { getWorkout } from "../helpers/requestSender/workoutsRequests";
import { createWorkoutFixture } from "../helpers/db/workoutHelper";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("GET /api/workouts/:id", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should return workout with exercises in position order", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;
    const dbUser = await prisma.user.findUnique({
      where: { email: registerUserDto.email!.toLowerCase() },
      select: { id: true },
    });

    const ex1 = await createExercise(prisma);
    const ex2 = await createExercise(prisma);
    const ex3 = await createExercise(prisma);

    const workout = await createWorkoutFixture(prisma, {
      userId: dbUser!.id,
      name: "Ordered Workout",
      exercises: [
        { exerciseId: ex1.id, position: 0 },
        { exerciseId: ex2.id, position: 1 },
        { exerciseId: ex3.id, position: 2 },
      ],
    });

    const response = await getWorkout(app, token, workout.id);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.exercises).toHaveLength(3);
    expect(response.body.data.exercises[0].position).toBe(0);
    expect(response.body.data.exercises[1].position).toBe(1);
    expect(response.body.data.exercises[2].position).toBe(2);
    expect(response.body.data.exercises[0].exercise).toHaveProperty("code");
    expect(response.body.data.exercises[0].exercise).toHaveProperty(
      "displayName",
    );
    expect(response.body.data.exercises[0].exercise).toHaveProperty(
      "exerciseType",
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

    const response = await getWorkout(app, tokenB, workout.id);

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("should return 404 for non-existent id", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const response = await getWorkout(app, token, 999999);

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("should return 401 without auth token", async () => {
    const response = await getWorkout(app, undefined, 1);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
