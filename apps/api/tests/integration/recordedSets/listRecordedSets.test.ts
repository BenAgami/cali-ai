import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { ExerciseType, ProcessingStatus, type getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import {
  listRecordedSets,
  createRecordedSet,
} from "../helpers/requestSender/recordedSetsRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { grantAiPrerequisites } from "../helpers/db/aiPrerequisitesHelper";

import { RecordedSetBuilder } from "../builders/recordedSetBuilder";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("GET /api/recorded-sets", () => {
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

  it("should list recorded sets with pagination", async () => {
    const { token } = await registerReadyUser();

    const exercise = { code: "push_up" };
    const now = new Date();

    await createRecordedSet(
      app,
      token,
      new RecordedSetBuilder()
        .setExerciseCode(exercise.code)
        .setPerformedAt(new Date(now.getTime() - 1000 * 60).toISOString())
        .build(),
    );
    await createRecordedSet(
      app,
      token,
      new RecordedSetBuilder()
        .setExerciseCode(exercise.code)
        .setPerformedAt(new Date(now.getTime() - 1000 * 60 * 2).toISOString())
        .build(),
    );
    await createRecordedSet(
      app,
      token,
      new RecordedSetBuilder()
        .setExerciseCode(exercise.code)
        .setPerformedAt(new Date(now.getTime() - 1000 * 60 * 3).toISOString())
        .build(),
    );

    const response = await listRecordedSets(app, token, {
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

  it("should return remaining recorded sets when using offset", async () => {
    const { token } = await registerReadyUser();

    const exercise = { code: "push_up" };
    const now = new Date();

    await createRecordedSet(
      app,
      token,
      new RecordedSetBuilder()
        .setExerciseCode(exercise.code)
        .setPerformedAt(new Date(now.getTime() - 1000 * 60).toISOString())
        .build(),
    );
    await createRecordedSet(
      app,
      token,
      new RecordedSetBuilder()
        .setExerciseCode(exercise.code)
        .setPerformedAt(new Date(now.getTime() - 1000 * 60 * 2).toISOString())
        .build(),
    );
    await createRecordedSet(
      app,
      token,
      new RecordedSetBuilder()
        .setExerciseCode(exercise.code)
        .setPerformedAt(new Date(now.getTime() - 1000 * 60 * 3).toISOString())
        .build(),
    );

    const response = await listRecordedSets(app, token, {
      limit: 2,
      offset: 2,
    });

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.page.hasMore).toBe(false);
    expect(response.body.data.page.nextOffset).toBeNull();
  });

  it("should filter recorded sets by exerciseCode", async () => {
    const { token } = await registerReadyUser();

    const exerciseCodeA = "push_up";
    const exerciseCodeB = "squat";
    const exerciseA = { code: exerciseCodeA };
    const exerciseB = { code: exerciseCodeB };

    await createRecordedSet(
      app,
      token,
      new RecordedSetBuilder().setExerciseCode(exerciseA.code).build(),
    );
    await createRecordedSet(
      app,
      token,
      new RecordedSetBuilder().setExerciseCode(exerciseB.code).build(),
    );

    const response = await listRecordedSets(app, token, {
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
    const workout = await prisma.workoutPlan.create({
      data: { userId, name: "W" },
    });

    const processing = await prisma.recordedSet.create({
      data: {
        userId,
        exerciseId: exercise.id,
        workoutPlanId: workout.id,
        setNumber: 1,
        processingStatus: ProcessingStatus.PROCESSING,
        bullmqJobId: "analysis-1",
      },
    });
    const completed = await prisma.recordedSet.create({
      data: {
        userId,
        exerciseId: exercise.id,
        processingStatus: ProcessingStatus.COMPLETED,
      },
    });
    await prisma.recordedSet.create({
      data: {
        userId: other.userId,
        exerciseId: exercise.id,
        processingStatus: ProcessingStatus.PROCESSING,
      },
    });
    await prisma.analysisResult.create({
      data: {
        recordedSetId: completed.id,
        outcome: "SCORED",
        formScore: 88,
        summaryFeedback: "Nice",
      },
    });

    const filtered = await listRecordedSets(app, token, {
      processingStatus: "PROCESSING",
    });

    expect(filtered.status).toBe(StatusCodes.OK);
    expect(filtered.body.data.items).toHaveLength(1);
    expect(filtered.body.data.items[0]).toMatchObject({
      id: processing.id,
      workoutPlanId: workout.id,
      setNumber: 1,
      bullmqJobId: "analysis-1",
      analysisResult: null,
    });

    const all = await listRecordedSets(app, token);
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

    const response = await listRecordedSets(app, token, {
      processingStatus: "BOGUS",
    });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("should return 401 if no token is provided", async () => {
    const response = await listRecordedSets(app, undefined);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(response.body.message).toBe(
      "Authorization header missing or malformed",
    );
  });

  it("should return 400 for invalid limit query", async () => {
    const { token } = await registerReadyUser();

    const response = await listRecordedSets(app, token, {
      limit: 0,
    });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toContain("query.limit");
  });
});
