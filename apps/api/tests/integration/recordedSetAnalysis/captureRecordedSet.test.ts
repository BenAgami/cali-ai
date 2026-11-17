import { gzipSync } from "node:zlib";
import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { type getPrismaClient, ProcessingStatus } from "@repo/db";
import { API_ERROR_CODES, CAPTURE_LIMITS } from "@repo/common";

import { env } from "../../../src/config/env";
import { formAnalysisQueue } from "../../../src/lib/queue";
import { decodeCapture } from "../../../src/utils/captureCodec";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { closeQueueConnections, resetAnalysisQueue } from "../helpers/queue";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createRecordedSet } from "../helpers/requestSender/recordedSetsRequests";
import {
  submitCapture,
  submitRawCapture,
} from "../helpers/requestSender/recordedSetAnalysisRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { grantAiPrerequisites } from "../helpers/db/aiPrerequisitesHelper";

import { PoseCaptureBuilder } from "../builders/poseCaptureBuilder";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";
import { RecordedSetBuilder } from "../builders/recordedSetBuilder";

describe("POST /api/recorded-sets/:id/capture", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;
  let token: string;
  let exerciseCode: string;

  const newRecordedSet = async (): Promise<number> => {
    const res = await createRecordedSet(
      app,
      token,
      new RecordedSetBuilder().setExerciseCode(exerciseCode).build(),
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
    const recordedSetId = await newRecordedSet();
    const payload = new PoseCaptureBuilder().build();

    const startedAt = performance.now();
    const response = await submitCapture(app, token, recordedSetId, payload);
    const elapsedMs = performance.now() - startedAt;

    expect(response.status).toBe(StatusCodes.ACCEPTED);
    expect(response.body.data).toEqual({
      recordedSetId,
      captureId: expect.any(Number),
      jobId: expect.stringMatching(/^analysis-/),
      status: "QUEUED",
    });
    expect(elapsedMs).toBeLessThan(500);

    const { jobId, captureId } = response.body.data as {
      jobId: string;
      captureId: number;
    };

    const recordedSet = await prisma.recordedSet.findUniqueOrThrow({
      where: { id: recordedSetId },
    });
    expect(recordedSet.processingStatus).toBe(ProcessingStatus.PROCESSING);
    expect(recordedSet.analysisStage).toBe("QUEUED");
    expect(recordedSet.bullmqJobId).toBe(jobId);
    expect(recordedSet.processingStartedAt).not.toBeNull();

    const capture = await prisma.poseCapture.findUniqueOrThrow({
      where: { recordedSetId },
    });
    expect(capture.keypointsFormat).toBe("gzip-json-v1");
    expect(capture.frameCount).toBe(900);
    expect(await decodeCapture(capture.keypoints!)).toEqual(payload);

    const job = await formAnalysisQueue.getJob(jobId);
    expect(job?.data).toEqual({ recordedSetId, captureId });
  });

  it("returns 400 for an uncompressed JSON body", async () => {
    const recordedSetId = await newRecordedSet();
    const payload = new PoseCaptureBuilder().setFrames(30).build();

    const response = await submitRawCapture(
      app,
      token,
      recordedSetId,
      Buffer.from(JSON.stringify(payload)),
      "application/json",
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("returns 401 without a token", async () => {
    const recordedSetId = await newRecordedSet();

    const response = await submitCapture(
      app,
      undefined,
      recordedSetId,
      new PoseCaptureBuilder().setFrames(30).build(),
    );

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("returns 404 for another user recorded set", async () => {
    const recordedSetId = await newRecordedSet();
    const otherToken = await registerToken();

    const response = await submitCapture(
      app,
      otherToken,
      recordedSetId,
      new PoseCaptureBuilder().setFrames(30).build(),
    );

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("returns 404 for a nonexistent recorded set", async () => {
    const response = await submitCapture(
      app,
      token,
      999_999,
      new PoseCaptureBuilder().setFrames(30).build(),
    );

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("returns 400 for a non-numeric recorded set id", async () => {
    const response = await submitCapture(
      app,
      token,
      "abc",
      new PoseCaptureBuilder().setFrames(30).build(),
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("returns 400 when frameCount does not match frames.length", async () => {
    const recordedSetId = await newRecordedSet();

    const response = await submitCapture(
      app,
      token,
      recordedSetId,
      new PoseCaptureBuilder().setFrames(30).setFrameCount(31).build(),
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("returns 413 when the compressed body exceeds 1 MiB", async () => {
    const recordedSetId = await newRecordedSet();
    const payload = new PoseCaptureBuilder()
      .setFrames(3600, 33)
      .setRandomCoordinates()
      .build();
    const compressed = gzipSync(Buffer.from(JSON.stringify(payload)));
    expect(compressed.length).toBeGreaterThan(
      CAPTURE_LIMITS.maxCompressedBytes,
    );

    const response = await submitCapture(app, token, recordedSetId, payload);

    expect(response.status).toBe(StatusCodes.REQUEST_TOO_LONG);
  });

  it("rejects an oversized body without a token before reading it", async () => {
    const recordedSetId = await newRecordedSet();
    const payload = new PoseCaptureBuilder()
      .setFrames(3600, 33)
      .setRandomCoordinates()
      .build();

    const outcome = await submitCapture(
      app,
      undefined,
      recordedSetId,
      payload,
    ).then(
      (response) => response.status,
      (error: NodeJS.ErrnoException) => error.code,
    );

    expect([StatusCodes.UNAUTHORIZED, "ECONNRESET"]).toContain(outcome);
  });

  it("returns 400 when an application/gzip body is not valid gzip", async () => {
    const recordedSetId = await newRecordedSet();

    const response = await submitRawCapture(
      app,
      token,
      recordedSetId,
      Buffer.from("this is not gzip"),
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("returns 400 when the gzip body does not contain JSON", async () => {
    const recordedSetId = await newRecordedSet();

    const response = await submitRawCapture(
      app,
      token,
      recordedSetId,
      gzipSync(Buffer.from("not json")),
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("returns 413 when a small gzip body inflates past the decompressed cap", async () => {
    const recordedSetId = await newRecordedSet();
    const bomb = gzipSync(Buffer.alloc(CAPTURE_LIMITS.maxInflatedBytes + 1));
    expect(bomb.length).toBeLessThan(CAPTURE_LIMITS.maxCompressedBytes);

    const response = await submitRawCapture(app, token, recordedSetId, bomb);

    expect(response.status).toBe(StatusCodes.REQUEST_TOO_LONG);
  });

  it("answers a resent capture with the first run and keeps one stored capture", async () => {
    const recordedSetId = await newRecordedSet();
    const payload = new PoseCaptureBuilder().setFrames(30).build();
    const first = await submitCapture(app, token, recordedSetId, payload);

    const response = await submitCapture(app, token, recordedSetId, payload);

    expect(response.status).toBe(StatusCodes.ACCEPTED);
    expect(response.body.data).toEqual(first.body.data);
    expect(await prisma.poseCapture.count({ where: { recordedSetId } })).toBe(
      1,
    );
  });

  it("returns 409 pointing to retry for a FAILED recorded set", async () => {
    const recordedSetId = await newRecordedSet();
    await prisma.recordedSet.update({
      where: { id: recordedSetId },
      data: { processingStatus: ProcessingStatus.FAILED },
    });

    const response = await submitCapture(
      app,
      token,
      recordedSetId,
      new PoseCaptureBuilder().setFrames(30).build(),
    );

    expect(response.status).toBe(StatusCodes.CONFLICT);
    expect(response.body.message).toContain("retry");
    expect(response.body.code).toBe("ANALYSIS_FAILED");
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

    const createPendingRecordedSet = async (
      userId: number,
      exerciseId: number,
    ): Promise<number> =>
      (
        await prisma.recordedSet.create({
          data: { userId, exerciseId, setNumber: 1 },
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
      const recordedSetId = await createPendingRecordedSet(
        user.userId,
        exercise.id,
      );

      const response = await submitCapture(
        app,
        user.token,
        recordedSetId,
        new PoseCaptureBuilder().setFrames(30).build(),
      );

      expect(response.status).toBe(StatusCodes.PRECONDITION_REQUIRED);
      expect(response.body.code).toBe("AI_CONSENT_REQUIRED");
      expect(await prisma.poseCapture.count({ where: { recordedSetId } })).toBe(
        0,
      );
    });

    it("returns 429 DAILY_ANALYSIS_LIMIT_REACHED once the daily cap of captures exists", async () => {
      const user = await newGatedUser();
      const exercise = await prisma.exercise.findUniqueOrThrow({
        where: { code: exerciseCode },
      });
      for (let i = 0; i < env.formAnalysis.dailyCap; i++) {
        const id = await createPendingRecordedSet(user.userId, exercise.id);
        await prisma.poseCapture.create({
          data: {
            recordedSetId: id,
            keypointsFormat: "gzip-json-v1",
            poseModelName: "movenet-lightning",
            poseModelVersion: "4",
            fps: 15,
            frameCount: 1,
            durationSec: 1,
          },
        });
      }
      const recordedSetId = await createPendingRecordedSet(
        user.userId,
        exercise.id,
      );

      const response = await submitCapture(
        app,
        user.token,
        recordedSetId,
        new PoseCaptureBuilder().setFrames(30).build(),
      );

      expect(response.status).toBe(StatusCodes.TOO_MANY_REQUESTS);
      expect(response.body.code).toBe("DAILY_ANALYSIS_LIMIT_REACHED");
    });

    it("never accepts more captures than the daily cap under concurrency", async () => {
      const concurrentRequests = 5;
      const user = await newGatedUser();
      const exercise = await prisma.exercise.findUniqueOrThrow({
        where: { code: exerciseCode },
      });
      for (let i = 0; i < env.formAnalysis.dailyCap - 1; i++) {
        const id = await createPendingRecordedSet(user.userId, exercise.id);
        await prisma.poseCapture.create({
          data: {
            recordedSetId: id,
            keypointsFormat: "gzip-json-v1",
            poseModelName: "movenet-lightning",
            poseModelVersion: "4",
            fps: 15,
            frameCount: 1,
            durationSec: 1,
          },
        });
      }
      const recordedSetIds = await Promise.all(
        Array.from({ length: concurrentRequests }, () =>
          createPendingRecordedSet(user.userId, exercise.id),
        ),
      );

      const responses = await Promise.all(
        recordedSetIds.map((recordedSetId) =>
          submitCapture(
            app,
            user.token,
            recordedSetId,
            new PoseCaptureBuilder().setFrames(30).build(),
          ),
        ),
      );

      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([
        StatusCodes.ACCEPTED,
        ...Array<StatusCodes>(concurrentRequests - 1).fill(
          StatusCodes.TOO_MANY_REQUESTS,
        ),
      ]);
      const rejected = responses.filter(
        (response) => response.status !== Number(StatusCodes.ACCEPTED),
      );
      for (const response of rejected) {
        expect(response.body.code).toBe(
          API_ERROR_CODES.DAILY_ANALYSIS_LIMIT_REACHED,
        );
      }
      expect(
        await prisma.poseCapture.count({
          where: { recordedSet: { userId: user.userId } },
        }),
      ).toBe(env.formAnalysis.dailyCap);
    });
  });
});
