import { gzipSync } from "node:zlib";

import {
  CAPTURE_LIMITS,
  poseCapturePayloadSchema,
  quantizeCapture,
  type PoseCapturePayload,
} from "@repo/common";

const makeRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const makePayload = (
  frameCount: number,
  random: () => number,
  fps = 15,
): PoseCapturePayload => ({
  version: 1,
  poseModelName: "blazepose-full",
  poseModelVersion: "1",
  fps,
  frameCount,
  durationSec: frameCount / fps,
  frames: Array.from({ length: frameCount }, (_, index) => ({
    timestampSec: index / fps,
    keypoints: Array.from(
      { length: 33 },
      () => [random(), random(), random()] as [number, number, number],
    ),
  })),
});

describe("poseCapturePayloadSchema aspectRatio", () => {
  const payload = makePayload(2, makeRandom(1));

  it("accepts a payload without aspectRatio", () => {
    expect(poseCapturePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("accepts a sane aspectRatio and rejects out-of-range values", () => {
    expect(
      poseCapturePayloadSchema.safeParse({ ...payload, aspectRatio: 0.5625 })
        .success,
    ).toBe(true);
    expect(
      poseCapturePayloadSchema.safeParse({ ...payload, aspectRatio: 0 })
        .success,
    ).toBe(false);
    expect(
      poseCapturePayloadSchema.safeParse({ ...payload, aspectRatio: 10 })
        .success,
    ).toBe(false);
  });
});

describe("quantizeCapture", () => {
  it("rounds coordinates, visibility and timestamps and stays valid", () => {
    const payload = makePayload(2, makeRandom(2));
    payload.frames[1].timestampSec = 1 / 15;
    payload.frames[0].keypoints[0] = [0.123456, 0.987654, 0.987];

    const result = quantizeCapture(payload);

    expect(result.frames[1].timestampSec).toBe(0.067);
    expect(result.frames[0].keypoints[0]).toEqual([0.123, 0.988, 0.99]);
    expect(result.frameCount).toBe(payload.frameCount);
    expect(result.frames).toHaveLength(payload.frames.length);
    expect(poseCapturePayloadSchema.safeParse(result).success).toBe(true);
  });

  it("fits a worst-case 180 s, 15 fps, 33-keypoint capture under the cap", () => {
    const payload = makePayload(2700, makeRandom(42));
    const compressed = gzipSync(
      JSON.stringify(quantizeCapture(payload)),
    ).length;

    expect(compressed).toBeLessThan(CAPTURE_LIMITS.maxCompressedBytes);
  });
});
