import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import type { getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { updateWorkout } from "../helpers/requestSender/workoutsRequests";
import { createWorkoutFixture } from "../helpers/db/workoutHelper";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("PATCH /api/workouts/:id", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should update name only", async () => {
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
      name: "Old Name",
      exercises: [
        {
          exerciseId: exercise.id,
          position: 0,
          sets: 3,
          reps: 10,
          restSecs: 60,
        },
      ],
    });

    const response = await updateWorkout(app, token, workout.id, {
      name: "New Name",
    });

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.name).toBe("New Name");
    expect(response.body.data.exercises).toHaveLength(1);
  });

  it("should replace entire exercises array", async () => {
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
    const newEx = await createExercise(prisma);

    const workout = await createWorkoutFixture(prisma, {
      userId: dbUser!.id,
      name: "Workout",
      exercises: [
        { exerciseId: ex1.id, position: 0 },
        { exerciseId: ex2.id, position: 1 },
        { exerciseId: ex3.id, position: 2 },
      ],
    });

    const response = await updateWorkout(app, token, workout.id, {
      exercises: [{ exerciseId: newEx.id, sets: 4, reps: 8, restSecs: 90 }],
    });

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.exercises).toHaveLength(1);
    expect(response.body.data.exercises[0].sets).toBe(4);

    const dbCount = await prisma.workoutExercise.count({
      where: { workoutId: workout.id },
    });
    expect(dbCount).toBe(1);
  });

  it("should renumber positions when exercises are reordered", async () => {
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
      name: "Workout",
      exercises: [
        { exerciseId: ex1.id, position: 0 },
        { exerciseId: ex2.id, position: 1 },
        { exerciseId: ex3.id, position: 2 },
      ],
    });

    const response = await updateWorkout(app, token, workout.id, {
      exercises: [
        { exerciseId: ex3.id, sets: 3, reps: 10, restSecs: 60 },
        { exerciseId: ex1.id, sets: 3, reps: 10, restSecs: 60 },
        { exerciseId: ex2.id, sets: 3, reps: 10, restSecs: 60 },
      ],
    });

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.exercises[0].position).toBe(0);
    expect(response.body.data.exercises[1].position).toBe(1);
    expect(response.body.data.exercises[2].position).toBe(2);
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

    const response = await updateWorkout(app, tokenB, workout.id, {
      name: "Hacked",
    });

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("should return 401 without auth token", async () => {
    const response = await updateWorkout(app, undefined, 1, { name: "X" });

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("should return 400 for invalid body", async () => {
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
      name: "Workout",
      exercises: [{ exerciseId: exercise.id, position: 0 }],
    });

    const response = await updateWorkout(app, token, workout.id, {
      exercises: [],
    });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });
});
