import type { PoseCapturePayload } from "@repo/common";

import { angleAt } from "../../../src/metrics/geometry";
import {
  chooseNearSide,
  jointTrack,
  toPoseSeries,
  UnsupportedCaptureError,
} from "../../../src/metrics/preprocess";

type Kp = [number, number, number];

const blankFrame = (count: number, visibility = 0.9): Kp[] =>
  Array.from({ length: count }, (): Kp => [0.5, 0.5, visibility]);

const payloadOf = (
  frames: Kp[][],
  extra: Partial<PoseCapturePayload> = {},
): PoseCapturePayload => ({
  version: 1,
  poseModelName: "blazepose",
  poseModelVersion: "1",
  fps: 15,
  frameCount: frames.length,
  durationSec: frames.length / 15,
  frames: frames.map((keypoints, i) => ({ timestampSec: i / 15, keypoints })),
  ...extra,
});

describe("toPoseSeries", () => {
  it("rejects a 17-keypoint payload", () => {
    const payload = payloadOf([blankFrame(17)]);
    expect(() => toPoseSeries(payload, "push_up")).toThrow(
      UnsupportedCaptureError,
    );
  });

  it("uses payload aspectRatio, else the orientation default", () => {
    const frames = [blankFrame(33)];
    expect(
      toPoseSeries(payloadOf(frames, { aspectRatio: 2 }), "push_up")
        .aspectRatio,
    ).toBe(2);
    expect(toPoseSeries(payloadOf(frames), "dip").aspectRatio).toBeCloseTo(
      16 / 9,
    );
    expect(toPoseSeries(payloadOf(frames), "squat").aspectRatio).toBeCloseTo(
      9 / 16,
    );
    expect(toPoseSeries(payloadOf(frames), "pull_up").aspectRatio).toBeCloseTo(
      9 / 16,
    );
  });

  it("falls back to the exercise camera view for unknown values", () => {
    const frames = [blankFrame(33)];
    expect(
      toPoseSeries(payloadOf(frames, { cameraView: "weird" }), "pull_up")
        .cameraView,
    ).toBe("front");
    expect(
      toPoseSeries(payloadOf(frames, { cameraView: "back" }), "pull_up")
        .cameraView,
    ).toBe("back");
  });

  it("measures the true angle on a non-square frame", () => {
    const aspect = 16 / 9;
    // right angle in isotropic coords, normalised by dividing x by aspect
    const frame = blankFrame(33);
    frame[11] = [(0.3 + 0.2) / aspect, 0.4, 0.9];
    frame[13] = [0.3 / aspect, 0.4, 0.9];
    frame[15] = [0.3 / aspect, 0.6, 0.9];
    const series = toPoseSeries(
      payloadOf([frame, frame, frame], { aspectRatio: aspect }),
      "push_up",
    );
    const row = series.points[1];
    expect(angleAt(row[11]!, row[13]!, row[15]!)).toBeCloseTo(90, 2);
  });

  it("fills a 2-frame dropout but leaves a 5-frame one null", () => {
    const frames = Array.from({ length: 20 }, (_, i): Kp[] => {
      const f = blankFrame(33);
      f[13] = [0.1 + i * 0.01, 0.5, 0.9];
      return f;
    });
    for (const i of [4, 5]) frames[i][13] = [0, 0, 0.1];
    for (const i of [10, 11, 12, 13, 14]) frames[i][13] = [0, 0, 0.1];
    const track = jointTrack(toPoseSeries(payloadOf(frames), "push_up"), 13);
    expect(track[4]).not.toBeNull();
    expect(track[5]).not.toBeNull();
    for (const i of [10, 11, 12, 13, 14]) expect(track[i]).toBeNull();
  });

  it("attenuates a single-frame spike by at least 80%", () => {
    const frames = Array.from({ length: 21 }, (): Kp[] => blankFrame(33));
    frames[10][13] = [0.5 + 0.2, 0.5, 0.9];
    const series = toPoseSeries(
      payloadOf(frames, { aspectRatio: 1 }),
      "push_up",
    );
    const track = jointTrack(series, 13);
    const worst = Math.max(...track.map((p) => Math.abs(p![0] - 0.5)));
    expect(worst).toBeLessThanOrEqual(0.04);
  });
});

describe("chooseNearSide", () => {
  it("returns the chain with higher mean key-joint visibility", () => {
    const frame = blankFrame(33, 0.3);
    for (const i of [12, 14, 16, 24, 28]) frame[i][2] = 0.95;
    const series = toPoseSeries(payloadOf([frame, frame]), "push_up");
    expect(chooseNearSide(series)).toBe("right");
    const left = blankFrame(33, 0.3);
    for (const i of [11, 13, 15, 23, 27]) left[i][2] = 0.95;
    expect(
      chooseNearSide(toPoseSeries(payloadOf([left, left]), "push_up")),
    ).toBe("left");
  });
});
