import { gzipSync } from "node:zlib";
import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { type getPrismaClient, SessionStatus } from "@repo/db";
import { CAPTURE_LIMITS } from "@repo/common";

import { env } from "../../../src/config/env";
import { formAnalysisQueue } from "../../../src/lib/queue";
import { decodeCapture } from "../../../src/utils/captureCodec";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { closeQueueConnections, resetAnalysisQueue } from "../helpers/queue";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createWorkoutSession } from "../helpers/requestSender/workoutSessionsRequests";
import {
  submitCapture,
  submitRawCapture,
} from "../helpers/requestSender/sessionsRequests";
import { createWorkoutFixture } from "../helpers/db/workoutHelper";
import { createExercise } from "../helpers/db/exerciseHelper";
import { grantAiPrerequisites } from "../helpers/db/aiPrerequisitesHelper";

import { PoseCaptureBuilder } from "../builders/poseCaptureBuilder";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";
import { WorkoutSessionBuilder } from "../builders/workoutSessionBuilder";

describe("POST /api/sessions/:id/capture", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;
  let token: string;
  let exerciseCode: string;

  const newSession = async (): Promise<number> => {
    const res = await createWorkoutSession(
      app,
      token,
      new WorkoutSessionBuilder().setExerciseCode(exerciseCode).build(),
    );
    return res.body.data.id as number;
  };

  const registerToken = async (): Promise<string> => {
    const dto = new RegisterUserBuilder().build();
    const res = await registerUser(app, dto);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: dto.email },
      select: { id: true },
    });
    await grantAiPrerequisites(prisma, user.id);
    return res.body.data.token as string;
  };

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

  it("returns 202 quickly, stores the capture and queues a job", async () => {
    const sessionId = await newSession();
    const payload = new PoseCaptureBuilder().build();

    const startedAt = performance.now();
    const response = await submitCapture(app, token, sessionId, payload);
    const elapsedMs = performance.now() - startedAt;

    expect(response.status).toBe(StatusCodes.ACCEPTED);
    expect(response.body.data).toEqual({
      sessionId,
      captureId: expect.any(Number),
      jobId: expect.stringMatching(/^analysis-/),
      status: "QUEUED",
    });
    expect(elapsedMs).toBeLessThan(500);

    const { jobId, captureId } = response.body.data as {
      jobId: string;
      captureId: number;
    };

    const session = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(session.processingStatus).toBe(SessionStatus.PROCESSING);
    expect(session.analysisStage).toBe("QUEUED");
    expect(session.bullmqJobId).toBe(jobId);
    expect(session.processingStartedAt).not.toBeNull();

    const capture = await prisma.poseCapture.findUniqueOrThrow({
      where: { sessionId },
    });
    expect(capture.keypointsFormat).toBe("gzip-json-v1");
    expect(capture.frameCount).toBe(900);
    expect(await decodeCapture(capture.keypoints!)).toEqual(payload);

    const job = await formAnalysisQueue.getJob(jobId);
    expect(job?.data).toEqual({ sessionId, captureId });
  });

  it("returns 400 for an uncompressed JSON body", async () => {
    const sessionId = await newSession();
    const payload = new PoseCaptureBuilder().setFrames(30).build();

    const response = await submitRawCapture(
      app,
      token,
      sessionId,
      Buffer.from(JSON.stringify(payload)),
      "application/json",
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("returns 401 without a token", async () => {
    const sessionId = await newSession();

    const response = await submitCapture(
      app,
      undefined,
      sessionId,
      new PoseCaptureBuilder().setFrames(30).build(),
    );

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("returns 404 for another user session", async () => {
    const sessionId = await newSession();
    const otherToken = await registerToken();

    const response = await submitCapture(
      app,
      otherToken,
      sessionId,
      new PoseCaptureBuilder().setFrames(30).build(),
    );

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("returns 404 for a nonexistent session", async () => {
    const response = await submitCapture(
      app,
      token,
      999_999,
      new PoseCaptureBuilder().setFrames(30).build(),
    );

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("returns 400 for a non-numeric session id", async () => {
    const response = await submitCapture(
      app,
      token,
      "abc",
      new PoseCaptureBuilder().setFrames(30).build(),
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("returns 400 when frameCount does not match frames.length", async () => {
    const sessionId = await newSession();

    const response = await submitCapture(
      app,
      token,
      sessionId,
      new PoseCaptureBuilder().setFrames(30).setFrameCount(31).build(),
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("returns 413 when the compressed body exceeds 1 MiB", async () => {
    const sessionId = await newSession();
    const payload = new PoseCaptureBuilder()
      .setFrames(3600, 33)
      .setRandomCoordinates()
      .build();
    const compressed = gzipSync(Buffer.from(JSON.stringify(payload)));
    expect(compressed.length).toBeGreaterThan(
      CAPTURE_LIMITS.maxCompressedBytes,
    );

    const response = await submitCapture(app, token, sessionId, payload);

    expect(response.status).toBe(StatusCodes.REQUEST_TOO_LONG);
  });

  it("rejects an oversized body without a token before reading it", async () => {
    const sessionId = await newSession();
    const payload = new PoseCaptureBuilder()
      .setFrames(3600, 33)
      .setRandomCoordinates()
      .build();

    const outcome = await submitCapture(
      app,
      undefined,
      sessionId,
      payload,
    ).then(
      (response) => response.status,
      (error: NodeJS.ErrnoException) => error.code,
    );

    expect([StatusCodes.UNAUTHORIZED, "ECONNRESET"]).toContain(outcome);
  });

  it("returns 400 when an application/gzip body is not valid gzip", async () => {
    const sessionId = await newSession();

    const response = await submitRawCapture(
      app,
      token,
      sessionId,
      Buffer.from("this is not gzip"),
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("returns 400 when the gzip body does not contain JSON", async () => {
    const sessionId = await newSession();

    const response = await submitRawCapture(
      app,
      token,
      sessionId,
      gzipSync(Buffer.from("not json")),
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("returns 413 when a small gzip body inflates past the decompressed cap", async () => {
    const sessionId = await newSession();
    const bomb = gzipSync(Buffer.alloc(CAPTURE_LIMITS.maxInflatedBytes + 1));
    expect(bomb.length).toBeLessThan(CAPTURE_LIMITS.maxCompressedBytes);

    const response = await submitRawCapture(app, token, sessionId, bomb);

    expect(response.status).toBe(StatusCodes.REQUEST_TOO_LONG);
  });

  it("returns 409 on a second capture and keeps one stored capture", async () => {
    const sessionId = await newSession();
    const payload = new PoseCaptureBuilder().setFrames(30).build();
    await submitCapture(app, token, sessionId, payload);

    const response = await submitCapture(app, token, sessionId, payload);

    expect(response.status).toBe(StatusCodes.CONFLICT);
    expect(await prisma.poseCapture.count({ where: { sessionId } })).toBe(1);
  });

  it("returns 409 pointing to retry for a FAILED session", async () => {
    const sessionId = await newSession();
    await prisma.workoutSession.update({
      where: { id: sessionId },
      data: { processingStatus: SessionStatus.FAILED },
    });

    const response = await submitCapture(
      app,
      token,
      sessionId,
      new PoseCaptureBuilder().setFrames(30).build(),
    );

    expect(response.status).toBe(StatusCodes.CONFLICT);
    expect(response.body.message).toContain("retry");
  });

  describe("consent and caps", () => {
    const newGatedUser = async () => {
      const dto = new RegisterUserBuilder().build();
      const res = await registerUser(app, dto);
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: dto.email },
        select: { id: true },
      });
      await grantAiPrerequisites(prisma, user.id);
      return { userId: user.id, token: res.body.data.token as string };
    };

    const createSetSession = async (
      userId: number,
      exerciseId: number,
      workoutId: number | null,
    ): Promise<number> =>
      (
        await prisma.workoutSession.create({
          data: { userId, exerciseId, workoutId, setNumber: 1 },
          select: { id: true },
        })
      ).id;

    it("returns 428 AI_CONSENT_REQUIRED for a stale consent version and stores nothing", async () => {
      const user = await newGatedUser();
      await prisma.user.update({
        where: { id: user.userId },
        data: { aiConsentVersion: "2026-11-04" },
      });
      const exercise = await prisma.exercise.findUniqueOrThrow({
        where: { code: exerciseCode },
      });
      const sessionId = await createSetSession(user.userId, exercise.id, null);

      const response = await submitCapture(
        app,
        user.token,
        sessionId,
        new PoseCaptureBuilder().setFrames(30).build(),
      );

      expect(response.status).toBe(StatusCodes.PRECONDITION_REQUIRED);
      expect(response.body.code).toBe("AI_CONSENT_REQUIRED");
      expect(await prisma.poseCapture.count({ where: { sessionId } })).toBe(0);
    });

    it("returns 429 DAILY_ANALYSIS_LIMIT_REACHED once the daily cap of captures exists", async () => {
      const user = await newGatedUser();
      const exercise = await prisma.exercise.findUniqueOrThrow({
        where: { code: exerciseCode },
      });
      for (let i = 0; i < env.formAnalysis.dailyCap; i++) {
        const id = await createSetSession(user.userId, exercise.id, null);
        await prisma.poseCapture.create({
          data: {
            sessionId: id,
            keypointsFormat: "gzip-json-v1",
            poseModelName: "movenet-lightning",
            poseModelVersion: "4",
            fps: 15,
            frameCount: 1,
            durationSec: 1,
          },
        });
      }
      const sessionId = await createSetSession(user.userId, exercise.id, null);

      const response = await submitCapture(
        app,
        user.token,
        sessionId,
        new PoseCaptureBuilder().setFrames(30).build(),
      );

      expect(response.status).toBe(StatusCodes.TOO_MANY_REQUESTS);
      expect(response.body.code).toBe("DAILY_ANALYSIS_LIMIT_REACHED");
    });

    it("returns 429 EXERCISE_ANALYSIS_LIMIT_REACHED on the third capture of an exercise in one workout, but accepts it in another workout", async () => {
      const user = await newGatedUser();
      const exercise = await prisma.exercise.findUniqueOrThrow({
        where: { code: exerciseCode },
      });
      const workoutA = await createWorkoutFixture(prisma, {
        userId: user.userId,
        exercises: [{ exerciseId: exercise.id, position: 1 }],
      });
      const workoutB = await createWorkoutFixture(prisma, {
        userId: user.userId,
        exercises: [{ exerciseId: exercise.id, position: 1 }],
      });
      const payload = new PoseCaptureBuilder().setFrames(30).build();

      for (let i = 0; i < env.formAnalysis.exerciseWorkoutCap; i++) {
        const id = await createSetSession(
          user.userId,
          exercise.id,
          workoutA.id,
        );
        const ok = await submitCapture(app, user.token, id, payload);
        expect(ok.status).toBe(StatusCodes.ACCEPTED);
      }

      const third = await createSetSession(
        user.userId,
        exercise.id,
        workoutA.id,
      );
      const blocked = await submitCapture(app, user.token, third, payload);
      expect(blocked.status).toBe(StatusCodes.TOO_MANY_REQUESTS);
      expect(blocked.body.code).toBe("EXERCISE_ANALYSIS_LIMIT_REACHED");

      const other = await createSetSession(
        user.userId,
        exercise.id,
        workoutB.id,
      );
      const accepted = await submitCapture(app, user.token, other, payload);
      expect(accepted.status).toBe(StatusCodes.ACCEPTED);
    });
  });
});
