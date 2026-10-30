import { gzipSync } from "node:zlib";
import {
  poseCapturePayloadSchema,
  type PoseCapturePayload,
} from "@repo/common";

import {
  decodeCapture,
  encodeCapture,
  InvalidCaptureError,
  KEYPOINTS_FORMAT,
} from "../../../src/utils/captureCodec";

type BuildOptions = { frames?: number; keypoints?: number; fps?: number };

const buildPayload = ({
  frames = 900,
  keypoints = 17,
  fps = 15,
}: BuildOptions = {}): PoseCapturePayload => ({
  version: 1,
  poseModelName: "movenet",
  poseModelVersion: "lightning-4",
  fps,
  frameCount: frames,
  durationSec: frames / fps,
  frames: Array.from({ length: frames }, (_, i) => ({
    timestampSec: i / fps,
    keypoints: Array.from(
      { length: keypoints },
      () => [0.5, 0.5, 0.9] as [number, number, number],
    ),
  })),
});

const issuePaths = (value: unknown): (string | number | symbol)[][] => {
  const result = poseCapturePayloadSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.path);
};

describe("poseCapturePayloadSchema", () => {
  it("accepts a valid 900-frame x 17-keypoint payload", () => {
    expect(poseCapturePayloadSchema.safeParse(buildPayload()).success).toBe(
      true,
    );
  });

  it("accepts 33 keypoints per frame", () => {
    expect(
      poseCapturePayloadSchema.safeParse(buildPayload({ keypoints: 33 }))
        .success,
    ).toBe(true);
  });

  it.each([
    ["version 2", { ...buildPayload({ frames: 5 }), version: 2 }],
    ["3601 frames", buildPayload({ frames: 3601, fps: 30 })],
    ["durationSec 0", { ...buildPayload({ frames: 5 }), durationSec: 0 }],
    ["durationSec 181", { ...buildPayload({ frames: 5 }), durationSec: 181 }],
    ["fps 4", { ...buildPayload({ frames: 5 }), fps: 4 }],
    ["fps 61", { ...buildPayload({ frames: 5 }), fps: 61 }],
    ["16 keypoints", buildPayload({ frames: 5, keypoints: 16 })],
    ["34 keypoints", buildPayload({ frames: 5, keypoints: 34 })],
    [
      "empty poseModelName",
      { ...buildPayload({ frames: 5 }), poseModelName: "" },
    ],
  ])("rejects %s", (_name, payload) => {
    expect(poseCapturePayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects frameCount that differs from frames.length at path frameCount", () => {
    const payload = { ...buildPayload({ frames: 5 }), frameCount: 6 };
    expect(issuePaths(payload)).toContainEqual(["frameCount"]);
  });

  it("rejects mixed 17/33 keypoint counts at path frames", () => {
    const payload = buildPayload({ frames: 5 });
    payload.frames[3] = {
      timestampSec: payload.frames[3].timestampSec,
      keypoints: buildPayload({ frames: 1, keypoints: 33 }).frames[0].keypoints,
    };
    expect(issuePaths(payload)).toContainEqual(["frames"]);
  });

  it.each([1.1, -0.1])("rejects score %s", (score) => {
    const payload = buildPayload({ frames: 5 });
    payload.frames[0].keypoints[0] = [0.5, 0.5, score];
    expect(poseCapturePayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects decreasing timestamps at path frames", () => {
    const payload = buildPayload({ frames: 5 });
    payload.frames[3].timestampSec = 0;
    expect(issuePaths(payload)).toContainEqual(["frames"]);
  });
});

const GZIP_SIGNATURE = [0x1f, 0x8b]; // Every gzip stream starts with these two bytes (RFC 1952).

describe("encodeCapture / decodeCapture", () => {
  it("exposes the storage format id", () => {
    expect(KEYPOINTS_FORMAT).toBe("gzip-json-v1");
  });

  it("encodes to a gzip buffer", async () => {
    const bytes = await encodeCapture(buildPayload({ frames: 10 }));
    const firstTwoBytes = [...bytes.subarray(0, GZIP_SIGNATURE.length)];
    expect(firstTwoBytes).toEqual(GZIP_SIGNATURE);
  });

  it("round-trips a payload unchanged", async () => {
    const payload = buildPayload();
    expect(await decodeCapture(await encodeCapture(payload))).toEqual(payload);
  });

  it("rejects non-gzip bytes with InvalidCaptureError", async () => {
    const result = decodeCapture(Buffer.from("not gzip"));
    await expect(result).rejects.toBeInstanceOf(InvalidCaptureError);
    await expect(result).rejects.toThrow("Capture blob is not valid gzip");
  });

  it("rejects non-JSON content with InvalidCaptureError", async () => {
    const result = decodeCapture(gzipSync(Buffer.from("not json")));
    await expect(result).rejects.toBeInstanceOf(InvalidCaptureError);
    await expect(result).rejects.toThrow("Capture blob is not valid JSON");
  });

  it("rejects schema-invalid JSON with InvalidCaptureError", async () => {
    const result = decodeCapture(gzipSync(Buffer.from('{"version":1}')));
    await expect(result).rejects.toBeInstanceOf(InvalidCaptureError);
    await expect(result).rejects.toThrow(/poseModelName - Invalid input/);
  });
});
