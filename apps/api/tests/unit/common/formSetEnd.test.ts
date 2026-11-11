import { evaluateSetEnd, type SetupFrame } from "@repo/common";

import { buildSyntheticCapture } from "../helpers/syntheticPose";

const FPS = 15;

const setFrames = (reps = 5): SetupFrame[] =>
  buildSyntheticCapture({ exercise: "push_up", reps, scale: 1, fps: FPS })
    .frames;

/** Appends `secs` of frames copied from the last one. */
const withTail = (
  frames: SetupFrame[],
  secs: number,
  mutate: (frame: SetupFrame) => SetupFrame = (frame) => frame,
): SetupFrame[] => {
  const last = frames[frames.length - 1];
  if (!last) throw new Error("no frames");
  const tail = Array.from(
    { length: Math.round(secs * FPS) },
    (_, index): SetupFrame =>
      mutate({
        timestampSec: last.timestampSec + (index + 1) / FPS,
        keypoints: last.keypoints.map((point): [number, number, number] => [
          ...point,
        ]),
      }),
  );
  return [...frames, ...tail];
};

const hide = (frame: SetupFrame): SetupFrame => ({
  ...frame,
  keypoints: frame.keypoints.map(([x, y]): [number, number, number] => [
    x,
    y,
    0.1,
  ]),
});

describe("evaluateSetEnd", () => {
  it("is not over with no frames", () => {
    expect(evaluateSetEnd({ frames: [], exerciseCode: "push_up" })).toEqual({
      isOver: false,
      stopsInSecs: null,
    });
  });

  it("is never over while the reps are still going", () => {
    const frames = setFrames();
    const lastRepFrame = frames.length - 1 - 2 * FPS;
    for (let end = FPS * 3; end <= lastRepFrame; end += FPS) {
      expect(
        evaluateSetEnd({
          frames: frames.slice(0, end),
          exerciseCode: "push_up",
        }).isOver,
      ).toBe(false);
    }
  });

  it("ends when the body leaves the frame and keeps only the set", () => {
    const frames = setFrames();
    const verdict = evaluateSetEnd({
      frames: withTail(frames, 8, hide),
      exerciseCode: "push_up",
    });
    expect(verdict).toEqual({ isOver: true, keepCount: frames.length });
  });

  it("does not end on a brief loss of tracking", () => {
    expect(
      evaluateSetEnd({
        frames: withTail(setFrames(), 3, hide),
        exerciseCode: "push_up",
      }).isOver,
    ).toBe(false);
  });

  it("ends when the body stands still after the set and drops the idle tail", () => {
    const frames = setFrames();
    const total = withTail(frames, 8);
    const verdict = evaluateSetEnd({
      frames: total,
      exerciseCode: "push_up",
    });
    expect(verdict.isOver).toBe(true);
    if (verdict.isOver) {
      expect(verdict.keepCount).toBeGreaterThanOrEqual(frames.length);
      expect(verdict.keepCount).toBeLessThan(total.length);
    }
  });

  it("does not end on stillness before any movement", () => {
    const first = setFrames()[0];
    if (!first) throw new Error("no frames");
    expect(
      evaluateSetEnd({
        frames: withTail([first], 15),
        exerciseCode: "push_up",
      }).isOver,
    ).toBe(false);
  });

  it("does not end when the body was never tracked", () => {
    expect(
      evaluateSetEnd({
        frames: setFrames().map(hide),
        exerciseCode: "push_up",
      }).isOver,
    ).toBe(false);
  });

  it("does not cut a recording that was tracked for only a moment", () => {
    const short = setFrames().slice(0, 2 * FPS);
    expect(
      evaluateSetEnd({
        frames: withTail(short, 10, hide),
        exerciseCode: "push_up",
      }).isOver,
    ).toBe(false);
  });

  it("ends from the clock when the pose model stops emitting frames", () => {
    const frames = setFrames();
    const last = frames[frames.length - 1];
    if (!last) throw new Error("no frames");
    const verdict = evaluateSetEnd({
      frames,
      exerciseCode: "push_up",
      nowSec: last.timestampSec + 5,
    });
    expect(verdict).toEqual({ isOver: true, keepCount: frames.length });
    expect(
      evaluateSetEnd({
        frames,
        exerciseCode: "push_up",
        nowSec: last.timestampSec + 3,
      }).isOver,
    ).toBe(false);
  });

  it("warns in the last seconds before the body-left end, and only then", () => {
    const frames = setFrames();
    const last = frames[frames.length - 1];
    if (!last) throw new Error("no frames");
    const stopsIn = (afterSecs: number) => {
      const verdict = evaluateSetEnd({
        frames,
        exerciseCode: "push_up",
        nowSec: last.timestampSec + afterSecs,
      });
      return verdict.isOver ? "over" : verdict.stopsInSecs;
    };
    expect(stopsIn(1)).toBeNull();
    expect(stopsIn(2)).toBe(3);
    expect(stopsIn(3.5)).toBe(2);
    expect(stopsIn(4.5)).toBe(1);
    expect(stopsIn(5)).toBe("over");
  });

  it("counts down to the stand-still end instead of stopping silently", () => {
    const frames = setFrames();
    const states = Array.from({ length: 9 }, (_, secs) => {
      const verdict = evaluateSetEnd({
        frames: withTail(frames, secs),
        exerciseCode: "push_up",
      });
      return verdict.isOver ? 0 : verdict.stopsInSecs;
    });
    const warnings = states.filter((state): state is number => state !== null);
    expect(states[0]).toBeNull();
    expect(warnings.length).toBeGreaterThan(1);
    expect(warnings[warnings.length - 1]).toBe(0);
    expect(warnings).toEqual([...warnings].sort((x, y) => y - x));
    expect(Math.max(...warnings)).toBeLessThanOrEqual(3);
  });
});
