import { Application } from "express";
import { randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";

import { getPrismaClient, ExerciseType } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { listExercises } from "../helpers/requestSender/exercisesRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { createAdminUserWithToken } from "../helpers/db/userHelper";

describe("GET /api/exercises", () => {
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

  it("should list active exercises with pagination", async () => {
    const exerciseA = await createExercise(prisma, {
      code: `push_up_${randomUUID().split("-")[0]}`,
      displayName: "Push Up A",
    });
    const exerciseB = await createExercise(prisma, {
      code: `pull_up_${randomUUID().split("-")[0]}`,
      displayName: "Pull Up B",
    });
    const exerciseC = await createExercise(prisma, {
      code: `squat_${randomUUID().split("-")[0]}`,
      displayName: "Squat C",
    });
    createdExerciseIds.push(exerciseA.id, exerciseB.id, exerciseC.id);

    const response = await listExercises(app, { limit: 2, offset: 0 });

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.page.hasMore).toBe(true);
    expect(response.body.data.page.nextOffset).toBe(2);
  });

  it("should exclude inactive exercises by default", async () => {
    const activeExercise = await createExercise(prisma, {
      code: `plank_${randomUUID().split("-")[0]}`,
      displayName: "Plank Active",
    });
    const inactiveExercise = await createExercise(prisma, {
      code: `plank_${randomUUID().split("-")[0]}_inactive`,
      displayName: "Plank Inactive",
      isActive: false,
    });
    createdExerciseIds.push(activeExercise.id, inactiveExercise.id);

    const response = await listExercises(app);

    expect(response.status).toBe(StatusCodes.OK);
    const codes = response.body.data.items.map((item: { code: string }) => item.code);
    expect(codes).toContain(activeExercise.code);
    expect(codes).not.toContain(inactiveExercise.code);
  });

  it("should include inactive exercises when includeInactive=true with admin auth", async () => {
    const { token } = await createAdminUserWithToken(prisma);

    const activeExercise = await createExercise(prisma, {
      code: `push_up_${randomUUID().split("-")[0]}`,
      displayName: "Push Up Active",
      exerciseType: ExerciseType.DYNAMIC,
    });
    const inactiveExercise = await createExercise(prisma, {
      code: `push_up_${randomUUID().split("-")[0]}_inactive`,
      displayName: "Push Up Inactive",
      isActive: false,
    });
    createdExerciseIds.push(activeExercise.id, inactiveExercise.id);

    const response = await listExercises(app, { includeInactive: true }, token);

    expect(response.status).toBe(StatusCodes.OK);
    const codes = response.body.data.items.map((item: { code: string }) => item.code);
    expect(codes).toContain(activeExercise.code);
    expect(codes).toContain(inactiveExercise.code);
  });

  it("should return 403 when non-admin requests includeInactive=true", async () => {
    const response = await listExercises(app, { includeInactive: true });

    expect(response.status).toBe(StatusCodes.FORBIDDEN);
  });

  it("should return 400 for invalid limit query", async () => {
    const response = await listExercises(app, { limit: 0 });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toContain("query.limit");
  });
});
