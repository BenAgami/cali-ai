import { Application } from "express";
import { randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";

import { getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { getExerciseByCode } from "../helpers/requestSender/exercisesRequests";
import { createExercise } from "../helpers/db/exerciseHelper";

describe("GET /api/exercises/:code", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;
  let createdExerciseIds: number[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterEach(async () => {
    if (createdExerciseIds.length > 0) {
      await prisma.exercise.deleteMany({
        where: { id: { in: createdExerciseIds } },
      });
      createdExerciseIds = [];
    }
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should return exercise by code", async () => {
    const exercise = await createExercise(prisma, {
      code: `push_up_${randomUUID().split("-")[0]}`,
      displayName: "Push Up One",
    });
    createdExerciseIds.push(exercise.id);

    const response = await getExerciseByCode(app, exercise.code);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.success).toBe(true);
    expect(response.body.data.code).toBe(exercise.code);
    expect(response.body.data.displayName).toBe(exercise.displayName);
  });

  it("should return 404 for unknown exercise code", async () => {
    const response = await getExerciseByCode(
      app,
      `missing_${randomUUID().split("-")[0]}`,
    );

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
    expect(response.body.message).toBe("Exercise not found");
  });

  it("should return 400 for invalid exercise code", async () => {
    const tooLongCode = "x".repeat(41);

    const response = await getExerciseByCode(app, tooLongCode);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toContain("params.code");
  });
});
