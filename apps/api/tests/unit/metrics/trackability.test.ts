import type { PoseCapturePayload } from "@repo/common";

import { toPoseSeries } from "../../../src/metrics/preprocess";
import {
  checkTrackability,
  MIN_REPS_FOR_BAND,
} from "../../../src/metrics/trackability";
import {
  buildSyntheticCapture,
  type SyntheticOptions,
} from "../helpers/syntheticPose";

const run = (
  options: SyntheticOptions,
  mutate?: (payload: PoseCapturePayload) => PoseCapturePayload,
) => {
  const built = buildSyntheticCapture(options);
  const payload = mutate ? mutate(built) : built;
  return checkTrackability(payload, toPoseSeries(payload, options.exercise));
};

const pushUp: SyntheticOptions = { exercise: "push_up", reps: 5 };

const reasonsOf = (result: ReturnType<typeof run>) =>
  result.isTrackable ? [] : result.reasons;

describe("checkTrackability", () => {
  it("accepts a clean synthetic push-up", () => {
    expect(run(pushUp)).toEqual({ isTrackable: true });
  });

  it("accepts a clean pull-up, squat and dip", () => {
    expect(run({ exercise: "pull_up", reps: 5 })).toEqual({
      isTrackable: true,
    });
    expect(run({ exercise: "squat", reps: 5 })).toEqual({ isTrackable: true });
    expect(run({ exercise: "dip", reps: 5 })).toEqual({ isTrackable: true });
  });

  it("flags too few frames and too short a duration", () => {
    const few = run(pushUp, (p) => ({
      ...p,
      frames: p.frames.slice(0, 10),
      frameCount: 10,
    }));
    expect(reasonsOf(few)).toContain("TOO_FEW_FRAMES");
    const short = run({
      exercise: "push_up",
      reps: 1,
      leadSec: 0.2,
      repSec: 1,
      restSec: 0.5,
    });
    expect(reasonsOf(short)).toContain("TOO_FEW_FRAMES");
  });

  it("flags low confidence", () => {
    expect(reasonsOf(run({ ...pushUp, visibility: 0.4 }))).toContain(
      "LOW_CONFIDENCE",
    );
  });

  it("flags hidden key joints", () => {
    const result = run({ ...pushUp, dropoutFrames: [[20, 90]] });
    expect(reasonsOf(result)).toContain("KEY_JOINTS_HIDDEN");
  });

  it("flags out-of-frame bodies", () => {
    const result = run(pushUp, (p) => ({
      ...p,
      frames: p.frames.map((frame) => ({
        ...frame,
        keypoints: frame.keypoints.map(([x, y, v]) => [x + 0.8, y, v]),
      })),
    }));
    expect(reasonsOf(result)).toContain("OUT_OF_FRAME");
  });

  it("flags a body that is too far away", () => {
    expect(reasonsOf(run({ ...pushUp, scale: 0.08 }))).toContain("TOO_FAR");
  });

  it("flags the wrong camera angle", () => {
    expect(reasonsOf(run({ ...pushUp, view: "front" }))).toContain(
      "WRONG_VIEW",
    );
    expect(
      reasonsOf(run({ exercise: "pull_up", reps: 5, view: "side" })),
    ).toContain("WRONG_VIEW");
  });

  it("returns every applicable reason in UNTRACKABLE_REASONS order", () => {
    const result = run({
      ...pushUp,
      scale: 0.08,
      view: "front",
      visibility: 0.4,
    });
    expect(reasonsOf(result)).toEqual([
      "LOW_CONFIDENCE",
      "KEY_JOINTS_HIDDEN",
      "TOO_FAR",
      "WRONG_VIEW",
    ]);
  });

  it("exposes the minimum rep count", () => {
    expect(MIN_REPS_FOR_BAND).toBe(2);
  });
});
