import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { API_ERROR_CODES } from "@repo/common";
import { type getPrismaClient, ProcessingStatus } from "@repo/db";

import { env } from "../../../src/config/env";
import { formAnalysisQueue } from "../../../src/lib/queue";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { closeQueueConnections, resetAnalysisQueue } from "../helpers/queue";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createRecordedSet } from "../helpers/requestSender/recordedSetsRequests";
import {
  retryAnalysis,
  submitCapture,
} from "../helpers/requestSender/recordedSetAnalysisRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { grantAiPrerequisites } from "../helpers/db/aiPrerequisitesHelper";

import { PoseCaptureBuilder } from "../builders/poseCaptureBuilder";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";
import { RecordedSetBuilder } from "../builders/recordedSetBuilder";

describe("POST /api/recorded-sets/:id/analysis/retry", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;
  let token: string;
  let exerciseCode: string;

  const registerUserWithToken = async (): Promise<{
    token: string;
    userId: number;
  }> => {
    const dto = new RegisterUserBuilder().build();
    const res = await registerUser(app, dto);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: dto.email },
      select: { id: true },
    });
    await grantAiPrerequisites(prisma, user.id);
    return { token: res.body.data.token as string, userId: user.id };
  };

  const registerToken = async (): Promise<string> =>
    (await registerUserWithToken()).token;

  const failedRecordedSet = async (userToken = token) => {
    const created = await createRecordedSet(
      app,
      userToken,
      new RecordedSetBuilder().setExerciseCode(exerciseCode).build(),
    );
    const recordedSetId = created.body.data.id as number;
    const accepted = await submitCapture(
      app,
      userToken,
      recordedSetId,
      new PoseCaptureBuilder().setFrames(30).build(),
    );
    expect(accepted.status).toBe(StatusCodes.ACCEPTED);

    await prisma.recordedSet.update({
      where: { id: recordedSetId },
      data: {
        processingStatus: ProcessingStatus.FAILED,
        failureReason: "TIMEOUT",
      },
    });
    return { recordedSetId, firstJobId: accepted.body.data.jobId as string };
  };

  const markFailed = (recordedSetId: number) =>
    prisma.recordedSet.update({
      where: { id: recordedSetId },
      data: {
        processingStatus: ProcessingStatus.FAILED,
        failureReason: "TIMEOUT",
      },
    });

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
    token = await registerToken();
    exerciseCode = (await createExercise(prisma, { code: "push_up" })).code;
  });

  beforeEach(async () => {
    await resetAnalysisQueue();
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
    await closeQueueConnections();
  });

  it("re-queues a FAILED recorded set from the stored capture", async () => {
    const { recordedSetId, firstJobId } = await failedRecordedSet();

    const response = await retryAnalysis(app, token, recordedSetId);

    expect(response.status).toBe(StatusCodes.ACCEPTED);
    const { jobId, captureId } = response.body.data as {
      jobId: string;
      captureId: number;
    };
    expect(jobId).not.toBe(firstJobId);
    expect(response.body.data.status).toBe("QUEUED");

    const recordedSet = await prisma.recordedSet.findUniqueOrThrow({
      where: { id: recordedSetId },
    });
    expect(recordedSet.processingStatus).toBe(ProcessingStatus.PROCESSING);
    expect(recordedSet.analysisStage).toBe("QUEUED");
    expect(recordedSet.failureReason).toBeNull();
    expect(recordedSet.bullmqJobId).toBe(jobId);

    const job = await formAnalysisQueue.getJob(jobId);
    expect(job?.data).toEqual({ recordedSetId, captureId });
  });

  it("returns 409 when retried again while PROCESSING", async () => {
    const { recordedSetId } = await failedRecordedSet();
    await retryAnalysis(app, token, recordedSetId);

    const response = await retryAnalysis(app, token, recordedSetId);

    expect(response.status).toBe(StatusCodes.CONFLICT);
  });

  it("returns 409 when the stored keypoints were removed", async () => {
    const { recordedSetId } = await failedRecordedSet();
    await prisma.poseCapture.update({
      where: { recordedSetId },
      data: { keypoints: null },
    });

    const response = await retryAnalysis(app, token, recordedSetId);

    expect(response.status).toBe(StatusCodes.CONFLICT);
  });

  it("returns 404 for another user", async () => {
    const { recordedSetId } = await failedRecordedSet();

    const response = await retryAnalysis(
      app,
      await registerToken(),
      recordedSetId,
    );

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("returns 401 without a token", async () => {
    const { recordedSetId } = await failedRecordedSet();

    const response = await retryAnalysis(app, undefined, recordedSetId);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  describe("daily retry cap", () => {
    it("refuses a retry over the cap and leaves the recorded set FAILED", async () => {
      const user = await registerUserWithToken();
      const first = await failedRecordedSet(user.token);
      const second = await failedRecordedSet(user.token);

      for (let i = 0; i < env.formAnalysis.dailyRetryCap; i++) {
        const target = i % 2 === 0 ? first : second;
        const accepted = await retryAnalysis(
          app,
          user.token,
          target.recordedSetId,
        );
        expect(accepted.status).toBe(StatusCodes.ACCEPTED);
        await markFailed(target.recordedSetId);
      }

      const refused = await retryAnalysis(app, user.token, first.recordedSetId);

      expect(refused.status).toBe(StatusCodes.TOO_MANY_REQUESTS);
      expect(refused.body.code).toBe(API_ERROR_CODES.DAILY_RETRY_LIMIT_REACHED);
      const recordedSet = await prisma.recordedSet.findUniqueOrThrow({
        where: { id: first.recordedSetId },
      });
      expect(recordedSet.processingStatus).toBe(ProcessingStatus.FAILED);
      expect(
        await prisma.analysisRetry.count({
          where: { recordedSet: { userId: user.userId } },
        }),
      ).toBe(env.formAnalysis.dailyRetryCap);
    });

    it("accepts a retry again once the recorded retries are older than 24 h", async () => {
      const user = await registerUserWithToken();
      const target = await failedRecordedSet(user.token);
      for (let i = 0; i < env.formAnalysis.dailyRetryCap; i++) {
        await prisma.analysisRetry.create({
          data: { recordedSetId: target.recordedSetId },
        });
      }
      expect(
        (await retryAnalysis(app, user.token, target.recordedSetId)).status,
      ).toBe(StatusCodes.TOO_MANY_REQUESTS);

      await prisma.analysisRetry.updateMany({
        where: { recordedSet: { userId: user.userId } },
        data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
      });

      expect(
        (await retryAnalysis(app, user.token, target.recordedSetId)).status,
      ).toBe(StatusCodes.ACCEPTED);
    });

    it("does not count a refused retry", async () => {
      const user = await registerUserWithToken();
      const target = await failedRecordedSet(user.token);
      await retryAnalysis(app, user.token, target.recordedSetId);

      const refused = await retryAnalysis(
        app,
        user.token,
        target.recordedSetId,
      );

      expect(refused.status).toBe(StatusCodes.CONFLICT);
      expect(
        await prisma.analysisRetry.count({
          where: { recordedSet: { userId: user.userId } },
        }),
      ).toBe(1);
    });

    it("does not consume the daily capture cap", async () => {
      const user = await registerUserWithToken();
      const target = await failedRecordedSet(user.token);
      const capturesBefore = await prisma.poseCapture.count({
        where: { recordedSet: { userId: user.userId } },
      });

      await retryAnalysis(app, user.token, target.recordedSetId);

      expect(
        await prisma.poseCapture.count({
          where: { recordedSet: { userId: user.userId } },
        }),
      ).toBe(capturesBefore);
    });

    it("never accepts more retries than the cap under concurrency", async () => {
      const concurrentRequests = 3;
      const user = await registerUserWithToken();
      const recordedSets = [];
      for (let i = 0; i < concurrentRequests; i++) {
        recordedSets.push(await failedRecordedSet(user.token));
      }
      for (let i = 0; i < env.formAnalysis.dailyRetryCap - 1; i++) {
        await prisma.analysisRetry.create({
          data: { recordedSetId: recordedSets[0].recordedSetId },
        });
      }

      const responses = await Promise.all(
        recordedSets.map(({ recordedSetId }) =>
          retryAnalysis(app, user.token, recordedSetId),
        ),
      );

      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([
        StatusCodes.ACCEPTED,
        ...Array<StatusCodes>(concurrentRequests - 1).fill(
          StatusCodes.TOO_MANY_REQUESTS,
        ),
      ]);
      expect(
        await prisma.analysisRetry.count({
          where: { recordedSet: { userId: user.userId } },
        }),
      ).toBe(env.formAnalysis.dailyRetryCap);
    });
  });
});
