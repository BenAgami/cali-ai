import { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { getPrismaClient, SessionStatus } from "@repo/db";

import { formAnalysisQueue } from "../../../src/lib/queue";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { closeQueueConnections, resetAnalysisQueue } from "../helpers/queue";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createWorkoutSession } from "../helpers/requestSender/workoutSessionsRequests";
import {
  retryAnalysis,
  submitCapture,
} from "../helpers/requestSender/sessionsRequests";
import { createExercise } from "../helpers/db/exerciseHelper";

import { PoseCaptureBuilder } from "../builders/poseCaptureBuilder";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";
import { WorkoutSessionBuilder } from "../builders/workoutSessionBuilder";

describe("POST /api/sessions/:id/analysis/retry", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;
  let token: string;
  let exerciseCode: string;

  const registerToken = async (): Promise<string> => {
    const res = await registerUser(app, new RegisterUserBuilder().build());
    return res.body.data.token as string;
  };

  // A session whose first capture was accepted and whose run then FAILED.
  const failedSession = async () => {
    const created = await createWorkoutSession(
      app,
      token,
      new WorkoutSessionBuilder().setExerciseCode(exerciseCode).build(),
    );
    const sessionId = created.body.data.id as number;
    const accepted = await submitCapture(
      app,
      token,
      sessionId,
      new PoseCaptureBuilder().setFrames(30).build(),
    );
    expect(accepted.status).toBe(StatusCodes.ACCEPTED);

    await prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        processingStatus: SessionStatus.FAILED,
        failureReason: "TIMEOUT",
      },
    });
    return { sessionId, firstJobId: accepted.body.data.jobId as string };
  };

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
    token = await registerToken();
    exerciseCode = (await createExercise(prisma)).code;
  });

  beforeEach(async () => {
    await resetAnalysisQueue();
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
    await closeQueueConnections();
  });

  it("re-queues a FAILED session from the stored capture", async () => {
    const { sessionId, firstJobId } = await failedSession();

    const response = await retryAnalysis(app, token, sessionId);

    expect(response.status).toBe(StatusCodes.ACCEPTED);
    const { jobId, captureId } = response.body.data as {
      jobId: string;
      captureId: number;
    };
    expect(jobId).not.toBe(firstJobId);
    expect(response.body.data.status).toBe("QUEUED");

    const session = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(session.processingStatus).toBe(SessionStatus.PROCESSING);
    expect(session.analysisStage).toBe("QUEUED");
    expect(session.failureReason).toBeNull();
    expect(session.bullmqJobId).toBe(jobId);

    const job = await formAnalysisQueue.getJob(jobId);
    expect(job?.data).toEqual({ sessionId, captureId });
  });

  it("returns 409 when retried again while PROCESSING", async () => {
    const { sessionId } = await failedSession();
    await retryAnalysis(app, token, sessionId);

    const response = await retryAnalysis(app, token, sessionId);

    expect(response.status).toBe(StatusCodes.CONFLICT);
  });

  it("returns 409 when the stored keypoints were removed", async () => {
    const { sessionId } = await failedSession();
    await prisma.poseCapture.update({
      where: { sessionId },
      data: { keypoints: null },
    });

    const response = await retryAnalysis(app, token, sessionId);

    expect(response.status).toBe(StatusCodes.CONFLICT);
  });

  it("returns 404 for another user", async () => {
    const { sessionId } = await failedSession();

    const response = await retryAnalysis(app, await registerToken(), sessionId);

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("returns 401 without a token", async () => {
    const { sessionId } = await failedSession();

    const response = await retryAnalysis(app, undefined, sessionId);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
