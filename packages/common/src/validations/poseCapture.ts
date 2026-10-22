import { z } from "zod";

export const CAPTURE_LIMITS = {
  maxCompressedBytes: 1_048_576,
  maxFrames: 3_600,
  maxDurationSec: 180,
  minFps: 5,
  maxFps: 60,
  minKeypoints: 17,
  maxKeypoints: 33,
} as const;

const keypointSchema = z.tuple([
  z.number(),
  z.number(),
  z.number().min(0).max(1),
]);

const frameSchema = z.object({
  t: z.number().min(0),
  kp: z
    .array(keypointSchema)
    .min(CAPTURE_LIMITS.minKeypoints)
    .max(CAPTURE_LIMITS.maxKeypoints),
});

export const poseCapturePayloadSchema = z
  .object({
    // Version literal is the hook for a future binary capture format.
    version: z.literal(1),
    poseModelName: z.string().trim().min(1).max(80),
    poseModelVersion: z.string().trim().min(1).max(40),
    fps: z.number().min(CAPTURE_LIMITS.minFps).max(CAPTURE_LIMITS.maxFps),
    frameCount: z.number().int().min(1).max(CAPTURE_LIMITS.maxFrames),
    durationSec: z.number().positive().max(CAPTURE_LIMITS.maxDurationSec),
    cameraView: z.string().trim().max(20).optional(),
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

    // Single pass: uniform keypoint count and non-decreasing timestamps.
    const expectedKeypoints = frames[0]?.kp.length;
    let previousT = -Infinity;
    let uniform = true;
    let ordered = true;
    for (const frame of frames) {
      if (frame.kp.length !== expectedKeypoints) uniform = false;
      if (frame.t < previousT) ordered = false;
      previousT = frame.t;
      if (!uniform && !ordered) break;
    }
    if (!uniform) {
      ctx.addIssue({
        code: "custom",
        path: ["frames"],
        message: "every frame must have the same keypoint count",
      });
    }
    if (!ordered) {
      ctx.addIssue({
        code: "custom",
        path: ["frames"],
        message: "frame timestamps must be non-decreasing",
      });
    }
  });

export type PoseCapturePayload = z.infer<typeof poseCapturePayloadSchema>;

export const captureAcceptedResponseSchema = z.object({
  sessionId: z.number().int(),
  captureId: z.number().int(),
  jobId: z.string(),
  status: z.literal("QUEUED"),
});
