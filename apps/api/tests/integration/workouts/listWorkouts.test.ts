import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import type { getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { listWorkouts } from "../helpers/requestSender/workoutsRequests";
import { createWorkoutFixture } from "../helpers/db/workoutHelper";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("GET /api/workouts", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should return empty list for new user", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const response = await listWorkouts(app, token);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.page.hasMore).toBe(false);
  });

  it("should return only the current user's workouts", async () => {
    const userADto = new RegisterUserBuilder().build();
    const userARes = await registerUser(app, userADto);
    const tokenA = userARes.body.data.token;

    const userBDto = new RegisterUserBuilder().build();
    const userBRes = await registerUser(app, userBDto);
    const dbUserB = await prisma.user.findUnique({
      where: { email: userBDto.email!.toLowerCase() },
      select: { id: true },
    });

    const exercise = await createExercise(prisma);
    await createWorkoutFixture(prisma, {
      userId: dbUserB!.id,
      name: "User B Workout",
      exercises: [{ exerciseId: exercise.id, position: 0 }],
    });

    const response = await listWorkouts(app, tokenA);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.items).toHaveLength(0);

    // Suppress unused variable warning
    void userBRes;
  });

  it("should return workouts ordered by updatedAt desc", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const dbUser = await prisma.user.findUnique({
      where: { email: registerUserDto.email!.toLowerCase() },
      select: { id: true },
    });
    const token = registerRes.body.data.token;

    const exercise = await createExercise(prisma);

    await createWorkoutFixture(prisma, {
      userId: dbUser!.id,
      name: "First",
      exercises: [{ exerciseId: exercise.id, position: 0 }],
    });
    await createWorkoutFixture(prisma, {
      userId: dbUser!.id,
      name: "Second",
      exercises: [{ exerciseId: exercise.id, position: 0 }],
    });
    await createWorkoutFixture(prisma, {
      userId: dbUser!.id,
      name: "Third",
      exercises: [{ exerciseId: exercise.id, position: 0 }],
    });

    const response = await listWorkouts(app, token);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.items[0].name).toBe("Third");
  });

  it("should return 401 without auth token", async () => {
    const response = await listWorkouts(app, undefined);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("should respect limit query param", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const dbUser = await prisma.user.findUnique({
      where: { email: registerUserDto.email!.toLowerCase() },
      select: { id: true },
    });
    const token = registerRes.body.data.token;

    const exercise = await createExercise(prisma);

    await createWorkoutFixture(prisma, {
      userId: dbUser!.id,
      name: "Workout 1",
      exercises: [{ exerciseId: exercise.id, position: 0 }],
    });
    await createWorkoutFixture(prisma, {
      userId: dbUser!.id,
      name: "Workout 2",
      exercises: [{ exerciseId: exercise.id, position: 0 }],
    });
    await createWorkoutFixture(prisma, {
      userId: dbUser!.id,
      name: "Workout 3",
      exercises: [{ exerciseId: exercise.id, position: 0 }],
    });

    const response = await listWorkouts(app, token, { limit: 2 });

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.page.hasMore).toBe(true);
  });
});
