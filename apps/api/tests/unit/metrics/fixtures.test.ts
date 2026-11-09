import { FORM_KEY_JOINTS, type PoseCapturePayload } from "@repo/common";

import {
  listPoseFixtures,
  loadPoseFixture,
  type PoseFixtureEntry,
} from "../helpers/poseFixtures";

const meanVisibility = (
  payload: PoseCapturePayload,
  frameIndex: number,
  joints: readonly number[],
): number => {
  const keypoints = payload.frames[frameIndex].keypoints;
  const total = joints.reduce((sum, j) => sum + (keypoints[j]?.[2] ?? 0), 0);
  return total / joints.length;
};

const nearSideVisibilityByFrame = (
  entry: PoseFixtureEntry,
  payload: PoseCapturePayload,
): number[] => {
  const { left, right } = FORM_KEY_JOINTS[entry.exercise];
  const indices = payload.frames.map((_, i) => i);
  const leftMean =
    indices.reduce((s, i) => s + meanVisibility(payload, i, left), 0) /
    indices.length;
  const rightMean =
    indices.reduce((s, i) => s + meanVisibility(payload, i, right), 0) /
    indices.length;
  const near = leftMean >= rightMean ? left : right;
  return indices.map((i) => meanVisibility(payload, i, near));
};

describe("pose fixtures", () => {
  const entries = listPoseFixtures();

  it("lists 16 entries with expected rep counts", () => {
    expect(entries).toHaveLength(16);
    for (const entry of entries) {
      expect(entry.expectedReps).toBe(entry.kind === "reps" ? 5 : 0);
    }
  });

  it.each(entries.map((entry) => [entry.file, entry] as const))(
    "%s loads through poseCapturePayloadSchema",
    (_file, entry) => {
      const payload = loadPoseFixture(entry);
      expect(payload.fps).toBe(15);
      expect(payload.aspectRatio).toBeDefined();
      for (const frame of payload.frames) {
        expect(frame.keypoints).toHaveLength(33);
      }
    },
  );

  it.each(
    entries
      .filter((entry) => entry.kind === "reps")
      .map((entry) => [entry.file, entry] as const),
  )("%s has a visible near-side body in 80% of frames", (_file, entry) => {
    const payload = loadPoseFixture(entry);
    const visibility = nearSideVisibilityByFrame(entry, payload);
    const visibleFrames = visibility.filter((v) => v >= 0.5).length;
    expect(visibleFrames / visibility.length).toBeGreaterThanOrEqual(0.8);
  });
});
