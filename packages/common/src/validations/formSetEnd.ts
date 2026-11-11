import { FORM_KEY_JOINTS, type FormAnalysisExercise } from "./formAnalysis";
import type { SetupFrame } from "./formSetup";

/** A body joint counts as seen at or above this pose-model confidence. */
const VISIBLE_MIN = 0.5;
/** Seconds without a tracked body before the set counts as over. */
const LOST_SECS = 5;
/** Seconds of near-zero movement before the set counts as over. */
const STILL_SECS = 6;
/** Shortest tracked stretch that can be a set, so the start is never cut. */
const MIN_SET_SECS = 6;
/** Joint travel (fraction of the frame) at or below which the body is still. */
const STILL_RANGE = 0.04;
/** Joint travel in a 2 s window that proves a set has started. */
const ACTIVE_RANGE = 0.08;
const ACTIVE_WINDOW_SECS = 2;
/** The warning starts this many seconds before the set is ended. */
const WARNING_SECS = 3;
const MOVING_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

export type SetEndVerdict =
  | {
      isOver: false;
      /** Whole seconds until the set ends, inside the warning window only. */
      stopsInSecs: number | null;
    }
  | {
      isOver: true;
      /** Frames to keep: everything up to the end of the set, idle tail dropped. */
      keepCount: number;
    };

const NOT_OVER: SetEndVerdict = { isOver: false, stopsInSecs: null };

const endsIn = (remainingSecs: number): SetEndVerdict => ({
  isOver: false,
  stopsInSecs:
    remainingSecs > 0 && remainingSecs <= WARNING_SECS
      ? Math.ceil(remainingSecs)
      : null,
});

const isSeen = (frame: SetupFrame, joint: number): boolean =>
  (frame.keypoints[joint]?.[2] ?? 0) >= VISIBLE_MIN;

const isTracked = (
  frame: SetupFrame,
  exerciseCode: FormAnalysisExercise,
): boolean => {
  const { left, right } = FORM_KEY_JOINTS[exerciseCode];
  const isLeftSeen = left.every((joint) => isSeen(frame, joint));
  const isRightSeen = right.every((joint) => isSeen(frame, joint));
  return exerciseCode === "pull_up"
    ? isLeftSeen && isRightSeen
    : isLeftSeen || isRightSeen;
};

/** Largest travel of any body joint across the frames, as a frame fraction. */
const motionRange = (frames: readonly SetupFrame[]): number => {
  let range = 0;
  for (const joint of MOVING_JOINTS) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const frame of frames) {
      const point = frame.keypoints[joint];
      if (!point) continue;
      minX = Math.min(minX, point[0]);
      maxX = Math.max(maxX, point[0]);
      minY = Math.min(minY, point[1]);
      maxY = Math.max(maxY, point[1]);
    }
    range = Math.max(range, maxX - minX, maxY - minY);
  }
  return range;
};

const hadMotion = (frames: readonly SetupFrame[]): boolean => {
  const first = frames[0];
  const last = frames[frames.length - 1];
  if (!first || !last) return false;
  for (
    let start = first.timestampSec;
    start + ACTIVE_WINDOW_SECS <= last.timestampSec;
    start += 1
  ) {
    const window = frames.filter(
      (frame) =>
        frame.timestampSec >= start &&
        frame.timestampSec < start + ACTIVE_WINDOW_SECS,
    );
    if (motionRange(window) >= ACTIVE_RANGE) return true;
  }
  return false;
};

/**
 * Index where a fully tracked, motionless tail of `secs` seconds begins, or
 * null. There must be frames before it, so a set that never moved cannot match.
 */
const tailStillIndex = (
  frames: readonly SetupFrame[],
  exerciseCode: FormAnalysisExercise,
  secs: number,
): number | null => {
  const last = frames[frames.length - 1];
  if (!last) return null;
  const start = last.timestampSec - secs;
  let index = 0;
  while (index < frames.length && (frames[index]?.timestampSec ?? 0) < start) {
    index += 1;
  }
  const tail = frames.slice(index);
  const isWindowFull =
    index > 0 && tail.every((frame) => isTracked(frame, exerciseCode));
  return isWindowFull && motionRange(tail) <= STILL_RANGE ? index : null;
};

/**
 * Decides, from the frames recorded so far, whether the set is over, so the
 * recording can stop without a tap (the user is away from the phone). Two
 * ends: the body left the frame, or it stood still after the set had started.
 * The idle tail is not part of the set, so `keepCount` cuts it off.
 *
 * The pose model emits no frame while it detects no body, so a frame's own
 * timestamp cannot show how long the body has been gone. `nowSec` is the
 * current time on the frames' clock; without it the newest frame stands in.
 */
export const evaluateSetEnd = (input: {
  frames: readonly SetupFrame[];
  exerciseCode: FormAnalysisExercise;
  nowSec?: number;
}): SetEndVerdict => {
  const { frames, exerciseCode } = input;
  const last = frames[frames.length - 1];
  if (!last) return NOT_OVER;

  let lastTrackedIndex = -1;
  let firstTrackedIndex = -1;
  frames.forEach((frame, index) => {
    if (!isTracked(frame, exerciseCode)) return;
    lastTrackedIndex = index;
    if (firstTrackedIndex === -1) firstTrackedIndex = index;
  });
  const firstTracked = frames[firstTrackedIndex];
  const lastTracked = frames[lastTrackedIndex];
  if (!firstTracked || !lastTracked) return NOT_OVER;

  const trackedSecs = lastTracked.timestampSec - firstTracked.timestampSec;
  if (trackedSecs < MIN_SET_SECS) return NOT_OVER;

  const nowSec = Math.max(input.nowSec ?? last.timestampSec, last.timestampSec);
  const lostSecs = nowSec - lastTracked.timestampSec;
  if (lostSecs >= LOST_SECS) {
    return { isOver: true, keepCount: lastTrackedIndex + 1 };
  }
  if (lostSecs > 0) return endsIn(LOST_SECS - lostSecs);

  // Windows are nested, so the longest still tail is found by growing it.
  let stillSecs = 0;
  let stillIndex = 0;
  for (let secs = 1; secs <= STILL_SECS; secs += 1) {
    const index = tailStillIndex(frames, exerciseCode, secs);
    if (index === null) break;
    stillSecs = secs;
    stillIndex = index;
  }
  if (stillSecs === 0 || !hadMotion(frames.slice(0, stillIndex))) {
    return NOT_OVER;
  }
  if (stillSecs >= STILL_SECS) return { isOver: true, keepCount: stillIndex };
  return endsIn(STILL_SECS - stillSecs);
};
