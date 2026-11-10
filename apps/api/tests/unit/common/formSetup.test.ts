import {
  BLAZEPOSE,
  CAPTURE_LIMITS,
  buildPoseCapturePayload,
  evaluateSetup,
  poseCapturePayloadSchema,
  SETUP_WINDOW_FRAMES,
  type FormAnalysisExercise,
  type SetupFrame,
} from "@repo/common";

import {
  buildSyntheticCapture,
  type SyntheticOptions,
} from "../helpers/syntheticPose";

const makeFrames = (
  exercise: FormAnalysisExercise,
  options: Partial<SyntheticOptions> = {},
): { frames: SetupFrame[]; aspectRatio: number } => {
  const capture = buildSyntheticCapture({
    exercise,
    reps: 2,
    scale: 1,
    ...options,
  });
  return {
    frames: capture.frames.slice(0, SETUP_WINDOW_FRAMES),
    aspectRatio: capture.aspectRatio ?? 1,
  };
};

const mapJoint = (
  frames: SetupFrame[],
  joint: number,
  update: (point: [number, number, number]) => [number, number, number],
): SetupFrame[] =>
  frames.map((frame) => ({
    ...frame,
    keypoints: frame.keypoints.map((point, index) =>
      index === joint ? update(point) : point,
    ),
  }));

describe("evaluateSetup", () => {
  it("is not ready with fewer than the window of frames", () => {
    const { frames, aspectRatio } = makeFrames("push_up");
    expect(
      evaluateSetup({
        frames: frames.slice(0, SETUP_WINDOW_FRAMES - 1),
        exerciseCode: "push_up",
        aspectRatio,
        lumaMean: 0.5,
      }),
    ).toEqual({ isReady: false, issue: "NOT_DETECTED" });
  });

  it("is ready for a clean side-on push-up", () => {
    const { frames, aspectRatio } = makeFrames("push_up");
    expect(
      evaluateSetup({
        frames,
        exerciseCode: "push_up",
        aspectRatio,
        lumaMean: 0.5,
      }),
    ).toEqual({ isReady: true, issue: null });
  });

  it("is ready for a clean front-on pull-up", () => {
    const { frames, aspectRatio } = makeFrames("pull_up", { scale: 0.5 });
    expect(
      evaluateSetup({
        frames,
        exerciseCode: "pull_up",
        aspectRatio,
        lumaMean: null,
      }).issue,
    ).toBeNull();
  });

  describe("detection", () => {
    it("reports TOO_DARK when joints are hidden and luma is low", () => {
      const { frames, aspectRatio } = makeFrames("push_up", {
        dropoutFrames: [[0, 14]],
      });
      expect(
        evaluateSetup({
          frames,
          exerciseCode: "push_up",
          aspectRatio,
          lumaMean: 0.1,
        }).issue,
      ).toBe("TOO_DARK");
    });

    it.each([0.5, null])(
      "reports NOT_DETECTED when joints are hidden and luma is %s",
      (lumaMean) => {
        const { frames, aspectRatio } = makeFrames("push_up", {
          dropoutFrames: [[0, 14]],
        });
        expect(
          evaluateSetup({
            frames,
            exerciseCode: "push_up",
            aspectRatio,
            lumaMean,
          }).issue,
        ).toBe("NOT_DETECTED");
      },
    );
  });

  describe("body partly out of frame", () => {
    const run = (
      update: (point: [number, number, number]) => [number, number, number],
    ) => {
      const { frames, aspectRatio } = makeFrames("push_up");
      const hidden = [BLAZEPOSE.LEFT_WRIST, BLAZEPOSE.RIGHT_WRIST].reduce(
        (current, joint) => mapJoint(current, joint, update),
        frames,
      );
      return evaluateSetup({
        frames: hidden,
        exerciseCode: "push_up",
        aspectRatio,
        lumaMean: 0.5,
      }).issue;
    };

    it.each([
      ["CLIPPED_LEFT", ([, y]: [number, number, number]) => [0, y, 0.1]],
      ["CLIPPED_RIGHT", ([, y]: [number, number, number]) => [1, y, 0.1]],
      ["CLIPPED_TOP", ([x]: [number, number, number]) => [x, 0, 0.1]],
      ["CLIPPED_BOTTOM", ([x]: [number, number, number]) => [x, 1, 0.1]],
    ] as const)(
      "names the edge when hidden joints sit at it: %s",
      (issue, update) => {
        expect(run(update as Parameters<typeof run>[0])).toBe(issue);
      },
    );

    it("stays NOT_DETECTED when hidden joints are not at an edge", () => {
      expect(run(([x, y]) => [x, y, 0.1])).toBe("NOT_DETECTED");
    });

    it("does not read an empty frame as clipped", () => {
      const { frames, aspectRatio } = makeFrames("push_up");
      const empty = frames.map((frame) => ({
        ...frame,
        keypoints: frame.keypoints.map((): [number, number, number] => [
          0, 0, 0,
        ]),
      }));
      expect(
        evaluateSetup({
          frames: empty,
          exerciseCode: "push_up",
          aspectRatio,
          lumaMean: 0.5,
        }).issue,
      ).toBe("NOT_DETECTED");
    });
  });

  describe("clipping", () => {
    const run = (
      update: (point: [number, number, number]) => [number, number, number],
    ) => {
      const { frames, aspectRatio } = makeFrames("push_up");
      return evaluateSetup({
        frames: mapJoint(frames, BLAZEPOSE.LEFT_WRIST, update),
        exerciseCode: "push_up",
        aspectRatio,
        lumaMean: 0.5,
      }).issue;
    };

    it("reports CLIPPED_LEFT", () => {
      expect(run(([, y, v]) => [0.01, y, v])).toBe("CLIPPED_LEFT");
    });
    it("reports CLIPPED_RIGHT", () => {
      expect(run(([, y, v]) => [0.99, y, v])).toBe("CLIPPED_RIGHT");
    });
    it("reports CLIPPED_TOP", () => {
      expect(run(([x, , v]) => [x, 0.01, v])).toBe("CLIPPED_TOP");
    });
    it("reports CLIPPED_BOTTOM", () => {
      expect(run(([x, , v]) => [x, 0.99, v])).toBe("CLIPPED_BOTTOM");
    });
  });

  it("reports TOO_FAR when the body spans 0.3 of the frame", () => {
    const { frames, aspectRatio } = makeFrames("push_up");
    // Shrink every landmark toward the frame centre.
    const shrunk = frames.map((frame) => {
      const xs = frame.keypoints.map(([x]) => x);
      const ys = frame.keypoints.map(([, y]) => y);
      const spanX = Math.max(...xs) - Math.min(...xs);
      const spanY = Math.max(...ys) - Math.min(...ys);
      const factor = 0.3 / Math.max(spanX, spanY);
      return {
        ...frame,
        keypoints: frame.keypoints.map(
          ([x, y, v]): [number, number, number] => [
            0.5 + (x - 0.5) * factor,
            0.5 + (y - 0.5) * factor,
            v,
          ],
        ),
      };
    });
    expect(
      evaluateSetup({
        frames: shrunk,
        exerciseCode: "push_up",
        aspectRatio,
        lumaMean: 0.5,
      }).issue,
    ).toBe("TOO_FAR");
  });

  it("reports WRONG_ANGLE for a push-up filmed from the front", () => {
    const { frames, aspectRatio } = makeFrames("push_up", { view: "front" });
    expect(
      evaluateSetup({
        frames,
        exerciseCode: "push_up",
        aspectRatio,
        lumaMean: 0.5,
      }).issue,
    ).toBe("WRONG_ANGLE");
  });

  it("reports WRONG_ANGLE for a pull-up filmed from the side", () => {
    const { frames, aspectRatio } = makeFrames("pull_up", {
      view: "side",
      scale: 0.5,
    });
    expect(
      evaluateSetup({
        frames,
        exerciseCode: "pull_up",
        aspectRatio,
        lumaMean: 0.5,
      }).issue,
    ).toBe("WRONG_ANGLE");
  });
});

describe("buildPoseCapturePayload", () => {
  const meta = {
    poseModelName: "blazepose_full",
    poseModelVersion: "pose_landmarker_full.task@0.4.0",
    aspectRatio: 0.75,
    cameraView: "side" as const,
  };
  const keypoints = (): [number, number, number][] =>
    Array.from({ length: 33 }, () => [0.123456, 0.654321, 0.987654]);

  const frameAt = (index: number, fps = 15): SetupFrame => ({
    timestampSec: 5 + index / fps,
    keypoints: keypoints(),
  });

  it("rebases timestamps to zero and passes the payload schema", () => {
    const frames = Array.from({ length: 30 }, (_, index) => frameAt(index));
    const payload = buildPoseCapturePayload(frames, meta);
    expect(payload.frames[0]?.timestampSec).toBe(0);
    expect(payload.fps).toBeCloseTo(15, 1);
    expect(payload.frameCount).toBe(30);
    expect(poseCapturePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("truncates to the frame cap", () => {
    const frames = Array.from(
      { length: CAPTURE_LIMITS.maxFrames + 50 },
      (_, index) => frameAt(index, 30),
    );
    const payload = buildPoseCapturePayload(frames, meta);
    expect(payload.frames).toHaveLength(CAPTURE_LIMITS.maxFrames);
    expect(payload.frameCount).toBe(CAPTURE_LIMITS.maxFrames);
    expect(payload.durationSec).toBeLessThanOrEqual(
      CAPTURE_LIMITS.maxDurationSec,
    );
  });

  it("clamps fps into the accepted range", () => {
    const slow = Array.from({ length: 3 }, (_, index) => frameAt(index, 1));
    expect(buildPoseCapturePayload(slow, meta).fps).toBe(CAPTURE_LIMITS.minFps);
    const fast = Array.from({ length: 5 }, (_, index) => frameAt(index, 200));
    expect(buildPoseCapturePayload(fast, meta).fps).toBe(CAPTURE_LIMITS.maxFps);
  });

  it("accepts a single frame", () => {
    const payload = buildPoseCapturePayload([frameAt(0)], meta);
    expect(poseCapturePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("quantizes coordinates", () => {
    const payload = buildPoseCapturePayload([frameAt(0), frameAt(1)], meta);
    expect(payload.frames[0]?.keypoints[0]).toEqual([0.123, 0.654, 0.99]);
  });

  it("includes optional device metadata only when given", () => {
    const frames = [frameAt(0), frameAt(1)];
    expect(buildPoseCapturePayload(frames, meta)).not.toHaveProperty(
      "deviceModel",
    );
    expect(
      buildPoseCapturePayload(frames, { ...meta, deviceModel: "SM-S926B" })
        .deviceModel,
    ).toBe("SM-S926B");
  });

  it("throws when no frames were captured", () => {
    expect(() => buildPoseCapturePayload([], meta)).toThrow(
      "No pose frames captured",
    );
  });
});
