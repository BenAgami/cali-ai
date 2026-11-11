import { angleAt } from "../../../src/metrics/geometry";
import { jointTrack, toPoseSeries } from "../../../src/metrics/preprocess";
import { segmentReps } from "../../../src/metrics/segmentReps";
import type { SegmentationParams } from "../../../src/metrics/types";
import { buildSyntheticCapture } from "../helpers/syntheticPose";

const FPS = 15;
const REP_SEC = 2;

const HIGH: SegmentationParams = {
  restLevel: "high",
  minAmplitude: 40,
  minRepSec: 0.8,
  maxRepSec: 15,
  minValidFrameRatio: 0.6,
};

/** Elbow-like signal: rest at 170, `repCount` cycles down to 90 and back. */
const buildSignal = (
  repCount: number,
  repSec = REP_SEC,
  options: { leadSec?: number; startLow?: boolean } = {},
): { signal: number[]; times: number[] } => {
  const lead = options.leadSec ?? 1;
  const total = lead * 2 + repCount * repSec;
  const n = Math.round(total * FPS);
  const signal: number[] = [];
  const times: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / FPS;
    const local = t - lead;
    const k = Math.floor(local / repSec);
    let p = 0;
    if (local >= 0 && k < repCount) {
      p = (1 - Math.cos((2 * Math.PI * (local - k * repSec)) / repSec)) / 2;
    }
    signal.push(170 - p * 80);
    times.push(t);
  }
  return { signal, times };
};

describe("segmentReps", () => {
  it("counts 5 clean cycles with the extreme at the signal minimum", () => {
    const { signal, times } = buildSignal(5);
    const result = segmentReps(signal, times, HIGH);
    expect(result.reps).toHaveLength(5);
    expect(result.reps.map((r) => r.repNumber)).toEqual([1, 2, 3, 4, 5]);
    for (const rep of result.reps) {
      const window = signal.slice(rep.startIndex, rep.endIndex + 1);
      const minIndex = rep.startIndex + window.indexOf(Math.min(...window));
      expect(Math.abs(rep.extremeIndex - minIndex)).toBeLessThanOrEqual(1);
    }
    expect(result.droppedRepCount).toBe(0);
  });

  it("returns 0 reps for a flat signal with jitter", () => {
    const times = Array.from({ length: 150 }, (_, i) => i / FPS);
    const signal = times.map((_, i) => 170 + (i % 2 === 0 ? 3 : -3));
    expect(segmentReps(signal, times, HIGH).reps).toHaveLength(0);
  });

  it("drops a 0.5 s cycle and counts it", () => {
    const slow = buildSignal(2, REP_SEC);
    const fast = buildSignal(1, 0.5, { leadSec: 0.5 });
    const signal = [...slow.signal, ...fast.signal];
    const times = signal.map((_, i) => i / FPS);
    const result = segmentReps(signal, times, HIGH);
    expect(result.reps).toHaveLength(2);
    expect(result.droppedRepCount).toBe(1);
  });

  it("drops a rep whose frames are half null", () => {
    const { signal, times } = buildSignal(4);
    const withNulls: (number | null)[] = [...signal];
    const rep = segmentReps(signal, times, HIGH).reps[2];
    for (let i = rep.startIndex; i <= rep.endIndex; i += 2) {
      // keep the turning point so the cycle is still detected
      if (Math.abs(i - rep.extremeIndex) > 1) withNulls[i] = null;
    }
    const result = segmentReps(withNulls, times, HIGH);
    expect(result.reps).toHaveLength(3);
    expect(result.droppedRepCount).toBe(1);
  });

  it("ignores a leading partial cycle when the recording starts at the bottom", () => {
    const { signal } = buildSignal(3, REP_SEC, { leadSec: 1 });
    // start mid-descent: prepend 8 frames at the bottom
    const prefix = Array.from({ length: 8 }, () => 90);
    const full = [...prefix, ...signal];
    const result = segmentReps(
      full,
      full.map((_, i) => i / FPS),
      HIGH,
    );
    expect(result.reps).toHaveLength(3);
  });

  it("supports restLevel low with a mirrored signal", () => {
    const { signal, times } = buildSignal(5);
    const mirrored = signal.map((v) => 260 - v);
    const result = segmentReps(mirrored, times, {
      ...HIGH,
      restLevel: "low",
    });
    expect(result.reps).toHaveLength(5);
  });

  it("returns nothing for an all-null signal", () => {
    const result = segmentReps([null, null], [0, 1], HIGH);
    expect(result.reps).toHaveLength(0);
  });
});

describe("buildSyntheticCapture", () => {
  it("round-trips a push-up elbow angle through toPoseSeries", () => {
    const payload = buildSyntheticCapture({
      exercise: "push_up",
      reps: 5,
      depthDeg: 90,
      lockoutDeg: 170,
      aspectRatio: 16 / 9,
    });
    const series = toPoseSeries(payload, "push_up");
    const shoulder = jointTrack(series, 11);
    const elbow = jointTrack(series, 13);
    const wrist = jointTrack(series, 15);
    const angles = elbow.flatMap((e, i) =>
      e && shoulder[i] && wrist[i] ? [angleAt(shoulder[i], e, wrist[i])] : [],
    );
    expect(Math.min(...angles)).toBeGreaterThan(87);
    expect(Math.min(...angles)).toBeLessThan(93);
    expect(Math.max(...angles)).toBeGreaterThan(167);
    expect(Math.max(...angles)).toBeLessThan(173);
  });
});
