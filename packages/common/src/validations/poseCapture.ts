import { z } from "zod";

export const CAPTURE_LIMITS = {
  maxCompressedBytes: 1_048_576,
  maxInflatedBytes: 10_485_760,
  maxFrames: 3_600,
  maxDurationSec: 180,
  minFps: 5,
  maxFps: 60,
  minKeypoints: 17,
  maxKeypoints: 33,
} as const;

export type Keypoint = [x: number, y: number, confidence: number];

const keypointSchema = z.tuple([
  z.number(),
  z.number(),
  z.number().min(0).max(1),
]) satisfies z.ZodType<Keypoint>;

const frameSchema = z.object({
  timestampSec: z.number().min(0),
  keypoints: z
    .array(keypointSchema)
    .min(CAPTURE_LIMITS.minKeypoints)
    .max(CAPTURE_LIMITS.maxKeypoints),
});

export const poseCapturePayloadSchema = z
  .object({
    version: z.literal(1),
    poseModelName: z.string().trim().min(1).max(80),
    poseModelVersion: z.string().trim().min(1).max(40),
    fps: z.number().min(CAPTURE_LIMITS.minFps).max(CAPTURE_LIMITS.maxFps),
    frameCount: z.number().int().min(1).max(CAPTURE_LIMITS.maxFrames),
    durationSec: z.number().positive().max(CAPTURE_LIMITS.maxDurationSec),
    // "side" | "front" | "back"
    cameraView: z.string().trim().max(20).optional(),
    // width / height of the oriented image the landmarks are normalised to
    aspectRatio: z.number().min(0.2).max(5).optional(),
    deviceModel: z.string().trim().max(80).optional(),
    appVersion: z.string().trim().max(40).optional(),
    frames: z.array(frameSchema).min(1).max(CAPTURE_LIMITS.maxFrames),
  })
  .superRefine((value, ctx) => {
    const { frames } = value;
    if (frames.length !== value.frameCount) {
      ctx.addIssue({
        code: "custom",
        path: ["frameCount"],
        message: "frameCount must equal frames.length",
      });
    }

    const expectedKeypointCount = frames[0]?.keypoints.length;
    let previousTimestampSec = -Infinity;
    let hasConsistentKeypointCount = true;
    let isInChronologicalOrder = true;
    for (const frame of frames) {
      if (frame.keypoints.length !== expectedKeypointCount) {
        hasConsistentKeypointCount = false;
      }
      if (frame.timestampSec < previousTimestampSec) {
        isInChronologicalOrder = false;
      }
      previousTimestampSec = frame.timestampSec;
      if (!hasConsistentKeypointCount && !isInChronologicalOrder) break;
    }
    if (!hasConsistentKeypointCount) {
      ctx.addIssue({
        code: "custom",
        path: ["frames"],
        message: "every frame must have the same keypoint count",
      });
    }
    if (!isInChronologicalOrder) {
      ctx.addIssue({
        code: "custom",
        path: ["frames"],
        message: "frame timestamps must be non-decreasing",
      });
    }
  });

export type PoseCapturePayload = z.infer<typeof poseCapturePayloadSchema>;

const round = (value: number, decimals: number): number =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

export const quantizeCapture = (
  payload: PoseCapturePayload,
): PoseCapturePayload => ({
  ...payload,
  durationSec: round(payload.durationSec, 3),
  frames: payload.frames.map((frame) => ({
    timestampSec: round(frame.timestampSec, 3),
    keypoints: frame.keypoints.map(
      ([x, y, v]): Keypoint => [round(x, 3), round(y, 3), round(v, 2)],
    ),
  })),
});

export const captureAcceptedResponseSchema = z.object({
  sessionId: z.number().int(),
  captureId: z.number().int(),
  jobId: z.string(),
  status: z.literal("QUEUED"),
});

export type CaptureAccepted = z.infer<typeof captureAcceptedResponseSchema>;
