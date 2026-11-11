import { percentile } from "./geometry";
import type { RepCycle, SegmentationParams, SegmentationResult } from "./types";

const UPPER_FACTOR = 0.7;
const LOWER_FACTOR = 0.3;

type Candidate = { startIndex: number; extremeIndex: number; endIndex: number };

/**
 * Hysteresis rep counter (05-RUBRICS section 3). Normalises the signal so
 * "rest" is high, detects rest -> past far threshold -> back to rest cycles.
 */
export const segmentReps = (
  signal: (number | null)[],
  timestampsSec: number[],
  params: SegmentationParams,
): SegmentationResult => {
  const values = signal.filter((v): v is number => v !== null);
  const empty = { reps: [], droppedRepCount: 0, amplitude: 0 };
  if (values.length === 0) return empty;

  const p5 = percentile(values, 5);
  const p95 = percentile(values, 95);
  const amplitude = p95 - p5;
  if (amplitude < params.minAmplitude) return { ...empty, amplitude };

  // Mirror a "low rest" signal so the cycle logic only handles "high rest".
  const isLow = params.restLevel === "low";
  const work = signal.map((v) => (v === null ? null : isLow ? -v : v));
  const lo = isLow ? -p95 : p5;
  const upper = lo + UPPER_FACTOR * amplitude;
  const lower = lo + LOWER_FACTOR * amplitude;

  const candidates: Candidate[] = [];
  let state: "unknown" | "rest" | "down" = "unknown";
  let lastRestIndex = -1;
  let startIndex = -1;
  let extremeIndex = -1;
  let extremeValue = Infinity;

  work.forEach((v, i) => {
    if (v === null) return;
    if (state === "unknown") {
      if (v >= upper) {
        state = "rest";
        lastRestIndex = i;
      }
      return;
    }
    if (state === "rest") {
      if (v >= upper) {
        lastRestIndex = i;
      } else if (v <= lower) {
        state = "down";
        startIndex = lastRestIndex;
        extremeIndex = i;
        extremeValue = v;
      }
      return;
    }
    if (v < extremeValue) {
      extremeValue = v;
      extremeIndex = i;
    }
    if (v >= upper) {
      candidates.push({ startIndex, extremeIndex, endIndex: i });
      state = "rest";
      lastRestIndex = i;
    }
  });

  const reps: RepCycle[] = [];
  let droppedRepCount = 0;
  for (const c of candidates) {
    const startSec = timestampsSec[c.startIndex] ?? 0;
    const endSec = timestampsSec[c.endIndex] ?? 0;
    const durationSec = endSec - startSec;
    const span = c.endIndex - c.startIndex + 1;
    let valid = 0;
    for (let i = c.startIndex; i <= c.endIndex; i += 1) {
      if (signal[i] !== null) valid += 1;
    }
    const validFrameRatio = valid / span;
    if (
      durationSec < params.minRepSec ||
      durationSec > params.maxRepSec ||
      validFrameRatio < params.minValidFrameRatio
    ) {
      droppedRepCount += 1;
      continue;
    }
    reps.push({
      repNumber: reps.length + 1,
      startIndex: c.startIndex,
      extremeIndex: c.extremeIndex,
      endIndex: c.endIndex,
      startSec,
      endSec,
      durationSec,
      validFrameRatio,
    });
  }
  return { reps, droppedRepCount, amplitude };
};
