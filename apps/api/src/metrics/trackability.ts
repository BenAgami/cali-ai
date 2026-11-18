import {
  BLAZEPOSE,
  FORM_KEY_JOINTS,
  UNTRACKABLE_REASONS,
  type PoseCapturePayload,
  type UntrackableReason,
} from "@repo/common";

import { distance, mean, median } from "./geometry";
import type { PoseSeries, Side, TrackabilityResult } from "./types";

/** Minimum reps for a band; fewer -> UNTRACKABLE NO_REPS_DETECTED (05-14). */
export const MIN_REPS_FOR_BAND = 2;

// 05-RUBRICS section 9
const THRESHOLDS = {
  minFrames: 15,
  minDurationSec: 3,
  minMeanVisibility: 0.5,
  minVisibleFrameRatio: 0.7,
  maxOutOfBoundsRatio: 0.1,
  minTorsoLength: 0.12,
  maxSideShoulderRatio: 0.55,
  minFrontShoulderRatio: 0.25,
} as const;

const { LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP } = BLAZEPOSE;

const torsoChains = (side: Side | null): Array<[number, number]> => {
  if (side === null) {
    return [
      [LEFT_SHOULDER, LEFT_HIP],
      [RIGHT_SHOULDER, RIGHT_HIP],
    ];
  }
  return side === "left"
    ? [[LEFT_SHOULDER, LEFT_HIP]]
    : [[RIGHT_SHOULDER, RIGHT_HIP]];
};

const keyJointIndices = (series: PoseSeries, side: Side | null): number[] => {
  const joints = FORM_KEY_JOINTS[series.exerciseCode];
  if (side === null) return [...joints.left, ...joints.right];
  return [...(side === "left" ? joints.left : joints.right)];
};

/**
 * Decides whether a set can be scored: checks length, visibility, framing,
 * camera distance and angle, and returns every failed check as a reason.
 */
export const checkTrackability = (
  payload: PoseCapturePayload,
  series: PoseSeries,
  side: Side | null,
): TrackabilityResult => {
  const reasons = new Set<UntrackableReason>();
  const frameCount = series.timestampsSec.length;
  const durationSec =
    frameCount > 1
      ? series.timestampsSec[frameCount - 1] - series.timestampsSec[0]
      : 0;
  if (
    frameCount < THRESHOLDS.minFrames ||
    durationSec < THRESHOLDS.minDurationSec
  ) {
    reasons.add("TOO_FEW_FRAMES");
  }

  const keys = keyJointIndices(series, side);

  const meanVisibility = mean(
    series.visibility.flatMap((row) => keys.map((k) => row[k])),
  );
  if (meanVisibility < THRESHOLDS.minMeanVisibility) {
    reasons.add("LOW_CONFIDENCE");
  }

  const visibleFrames = series.isRawValid.filter((row) =>
    keys.every((k) => row[k]),
  ).length;
  if (
    frameCount > 0 &&
    visibleFrames / frameCount < THRESHOLDS.minVisibleFrameRatio
  ) {
    reasons.add("KEY_JOINTS_HIDDEN");
  }

  let outCoordinates = 0;
  let totalCoordinates = 0;
  for (const frame of payload.frames) {
    for (const k of keys) {
      const keypoint = frame.keypoints[k];
      if (!keypoint) continue;
      for (const c of [keypoint[0], keypoint[1]]) {
        totalCoordinates += 1;
        if (c < 0 || c > 1) outCoordinates += 1;
      }
    }
  }
  if (
    totalCoordinates > 0 &&
    outCoordinates / totalCoordinates > THRESHOLDS.maxOutOfBoundsRatio
  ) {
    reasons.add("OUT_OF_FRAME");
  }

  const chains = torsoChains(side);
  const torsoPerFrame = series.rawPoints.map((row) =>
    mean(chains.map(([s, h]) => distance(row[s], row[h]))),
  );
  const medianTorso = median(torsoPerFrame.filter((v) => v > 0));
  if (medianTorso < THRESHOLDS.minTorsoLength) reasons.add("TOO_FAR");

  const ratios: number[] = [];
  series.rawPoints.forEach((row, f) => {
    const torso = torsoPerFrame[f];
    if (torso > 0) {
      ratios.push(distance(row[LEFT_SHOULDER], row[RIGHT_SHOULDER]) / torso);
    }
  });
  const shoulderRatio = median(ratios);
  if (!Number.isNaN(shoulderRatio)) {
    const isWrong =
      series.exerciseCode === "pull_up"
        ? shoulderRatio < THRESHOLDS.minFrontShoulderRatio
        : shoulderRatio > THRESHOLDS.maxSideShoulderRatio;
    if (isWrong) reasons.add("WRONG_VIEW");
  }

  if (reasons.size === 0) return { isTrackable: true };
  return {
    isTrackable: false,
    reasons: UNTRACKABLE_REASONS.filter((reason) => reasons.has(reason)),
  };
};
