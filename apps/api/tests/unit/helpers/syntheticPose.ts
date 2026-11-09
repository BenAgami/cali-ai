import {
  BLAZEPOSE,
  BLAZEPOSE_KEYPOINT_COUNT,
  FORM_CAPTURE_SETUP,
  type FormAnalysisExercise,
  type Keypoint,
  type PoseCapturePayload,
} from "@repo/common";

export type SyntheticOptions = {
  exercise: FormAnalysisExercise;
  reps: number;
  /** seconds per rep, default 2 */
  repSec?: number;
  /** rest at lockout between reps, default 0.5 */
  restSec?: number;
  /** rest before the first and after the last rep, default 1 */
  leadSec?: number;
  fps?: number;
  /** width / height of the frame the output is normalised to */
  aspectRatio?: number;
  /** near side for side-on views, default "left" */
  side?: "left" | "right";
  view?: "side" | "front" | "back";
  /** elbow angle (push_up, dip) or knee angle (squat) at the bottom */
  depthDeg?: number;
  /** elbow angle (push_up, dip) or knee angle (squat) at the top */
  lockoutDeg?: number;
  /** push_up / dip body line, in L units, + = hips sag */
  hipOffset?: number;
  trunkLeanDeg?: number;
  /** pull_up: mouth height below the bar at peak, in torso units (negative = above) */
  mouthBelowBar?: number;
  /** pull_up: left elbow flares outward by this angle */
  elbowAsymmetryDeg?: number;
  /** pull_up: shoulder line tilt */
  shoulderTiltDeg?: number;
  /** squat: heel lift */
  heelRiseDeg?: number;
  /** pull_up: lateral hip sway amplitude in torso units */
  hipSwayRatio?: number;
  /** uniform noise amplitude in isotropic units */
  noise?: number;
  /** inclusive frame index ranges where every landmark drops to low visibility */
  dropoutFrames?: Array<[start: number, end: number]>;
  visibility?: number;
  /** shoulder-to-ankle length relative to frame height */
  scale?: number;
  seed?: number;
};

type P = [number, number];

const DEG = Math.PI / 180;
const FAR_VISIBILITY = 0.3;
const DROPPED_VISIBILITY = 0.1;
const FRONT_SHOULDER_RATIO = 0.8;
const SIDE_SHOULDER_RATIO = 0.1;

const rot = (v: P, deg: number): P => [
  v[0] * Math.cos(deg * DEG) - v[1] * Math.sin(deg * DEG),
  v[0] * Math.sin(deg * DEG) + v[1] * Math.cos(deg * DEG),
];
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const scaleBy = (v: P, k: number): P => [v[0] * k, v[1] * k];
const lerp = (a: P, b: P, t: number): P => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

const DEFAULT_DEPTH: Record<FormAnalysisExercise, number> = {
  push_up: 90,
  dip: 90,
  squat: 80,
  pull_up: 50,
};

const makeRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

/** 0 at lockout, 1 at the bottom of a rep (raised cosine). */
const repProgress = (
  t: number,
  lead: number,
  repSec: number,
  restSec: number,
  reps: number,
): number => {
  const local = t - lead;
  if (local < 0) return 0;
  const period = repSec + restSec;
  const k = Math.floor(local / period);
  if (k >= reps) return 0;
  const u = local - k * period;
  return u < repSec ? (1 - Math.cos((2 * Math.PI * u) / repSec)) / 2 : 0;
};

type Skeleton = Map<number, { point: P; isFar: boolean }>;

export const buildSyntheticCapture = (
  options: SyntheticOptions,
): PoseCapturePayload => {
  const {
    exercise,
    reps,
    repSec = 2,
    restSec = 0.5,
    leadSec = 1,
    fps = 15,
    side = "left",
    noise = 0,
    dropoutFrames = [],
    visibility = 0.95,
    scale = 0.6,
    seed = 1,
    hipOffset = 0,
    trunkLeanDeg = exercise === "squat" ? 20 : 0,
    mouthBelowBar = -0.15,
    elbowAsymmetryDeg = 0,
    shoulderTiltDeg = 0,
    heelRiseDeg = 0,
    hipSwayRatio = 0,
  } = options;
  const setup = FORM_CAPTURE_SETUP[exercise];
  const aspectRatio =
    options.aspectRatio ??
    (setup.orientation === "landscape" ? 16 / 9 : 9 / 16);
  const view = options.view ?? setup.cameraView;
  const depthDeg = options.depthDeg ?? DEFAULT_DEPTH[exercise];
  const lockoutDeg = options.lockoutDeg ?? 170;
  const random = makeRandom(seed);

  const torso = 0.25 * scale;
  const limb = 0.15 * scale;
  const cx = aspectRatio / 2;
  const down: P = [0, 1];
  const up: P = [0, -1];
  const shoulderRatio =
    view === "side" ? SIDE_SHOULDER_RATIO : FRONT_SHOULDER_RATIO;
  const shoulderSpread = shoulderRatio * torso;

  const totalSec = 2 * leadSec + reps * (repSec + restSec);
  const frameCount = Math.max(1, Math.round(totalSec * fps));

  const sideOn = exercise !== "pull_up";

  /** Near-side chain keyed by LEFT landmark index. */
  const nearChain = (p: number): Map<number, P> => {
    const chain = new Map<number, P>();
    const angle = lockoutDeg - p * (lockoutDeg - depthDeg);
    if (exercise === "push_up" || exercise === "dip") {
      const floorY = exercise === "push_up" ? 0.8 : 0.5;
      const wrist: P =
        exercise === "push_up" ? [cx - 0.5 * scale, floorY] : [cx, floorY];
      const elbow = add(wrist, [0, -limb]);
      const shoulder = add(elbow, scaleBy(rot(down, angle), limb));
      chain.set(BLAZEPOSE.LEFT_WRIST, wrist);
      chain.set(BLAZEPOSE.LEFT_ELBOW, elbow);
      chain.set(BLAZEPOSE.LEFT_SHOULDER, shoulder);
      if (exercise === "push_up") {
        const ankle: P = [wrist[0] + 0.95 * scale, floorY];
        const lineLen = Math.hypot(
          ankle[0] - shoulder[0],
          ankle[1] - shoulder[1],
        );
        const dir: P = [
          (ankle[0] - shoulder[0]) / lineLen,
          (ankle[1] - shoulder[1]) / lineLen,
        ];
        const onLine = lerp(shoulder, ankle, torso / lineLen);
        const hip = add(
          onLine,
          scaleBy([-dir[1], dir[0]], hipOffset * lineLen),
        );
        chain.set(BLAZEPOSE.LEFT_HIP, hip);
        chain.set(BLAZEPOSE.LEFT_KNEE, lerp(hip, ankle, 0.5));
        chain.set(BLAZEPOSE.LEFT_ANKLE, ankle);
      } else {
        const hip = add(shoulder, scaleBy(rot(down, trunkLeanDeg), torso));
        const knee = add(hip, [0.04 * scale, 0.11 * scale]);
        const ankle = add(knee, [-0.03 * scale, 0.11 * scale]);
        chain.set(BLAZEPOSE.LEFT_HIP, hip);
        chain.set(BLAZEPOSE.LEFT_KNEE, knee);
        chain.set(BLAZEPOSE.LEFT_ANKLE, ankle);
      }
    } else {
      // squat: ankle fixed, knee angle drives the chain
      const ankle: P = [cx, 0.85];
      const shin = 0.27 * scale;
      const thigh = 0.27 * scale;
      const shinTilt = (180 - angle) * 0.35;
      const knee = add(ankle, scaleBy(rot(up, shinTilt), shin));
      const toAnkle: P = [ankle[0] - knee[0], ankle[1] - knee[1]];
      const toAnkleUnit = scaleBy(toAnkle, 1 / shin);
      const hip = add(knee, scaleBy(rot(toAnkleUnit, angle), thigh));
      const shoulder = add(hip, scaleBy(rot(up, trunkLeanDeg), torso));
      chain.set(BLAZEPOSE.LEFT_SHOULDER, shoulder);
      chain.set(BLAZEPOSE.LEFT_HIP, hip);
      chain.set(BLAZEPOSE.LEFT_KNEE, knee);
      chain.set(BLAZEPOSE.LEFT_ANKLE, ankle);
      const elbow = add(shoulder, [0.08 * scale, 0.1 * scale]);
      chain.set(BLAZEPOSE.LEFT_ELBOW, elbow);
      chain.set(BLAZEPOSE.LEFT_WRIST, add(elbow, [0.08 * scale, 0.02 * scale]));
    }
    return chain;
  };

  const sideOnSkeleton = (p: number): Skeleton => {
    const skeleton: Skeleton = new Map();
    const chain = nearChain(p);
    const isRightNear = side === "right";
    for (const [leftIndex, point] of chain) {
      const nearIndex = isRightNear ? leftIndex + 1 : leftIndex;
      const farIndex = isRightNear ? leftIndex : leftIndex + 1;
      if (view === "side") {
        skeleton.set(nearIndex, { point, isFar: false });
        skeleton.set(farIndex, {
          point: add(point, [0.02 * torso, 0.01 * torso]),
          isFar: true,
        });
      } else {
        skeleton.set(leftIndex, {
          point: add(point, [-shoulderSpread / 2, 0]),
          isFar: false,
        });
        skeleton.set(leftIndex + 1, {
          point: add(point, [shoulderSpread / 2, 0]),
          isFar: false,
        });
      }
    }
    const shoulder = chain.get(BLAZEPOSE.LEFT_SHOULDER)!;
    const ankle = chain.get(BLAZEPOSE.LEFT_ANKLE)!;
    const bodyDir: P = [Math.sign(ankle[0] - shoulder[0]) || -1, 0];
    const nose = add(shoulder, [-bodyDir[0] * 0.5 * torso, -0.3 * torso]);
    skeleton.set(BLAZEPOSE.NOSE, { point: nose, isFar: false });
    skeleton.set(BLAZEPOSE.MOUTH_LEFT, {
      point: add(nose, [0, 0.03]),
      isFar: false,
    });
    skeleton.set(BLAZEPOSE.MOUTH_RIGHT, {
      point: add(nose, [0, 0.03]),
      isFar: false,
    });
    for (const [leftIndex, offset] of [
      [BLAZEPOSE.LEFT_HEEL, [-0.02 * scale, 0.01]],
      [BLAZEPOSE.LEFT_FOOT_INDEX, [0.06 * scale, 0.02]],
    ] as Array<[number, P]>) {
      const base = chain.get(BLAZEPOSE.LEFT_ANKLE)!;
      const lift =
        leftIndex === BLAZEPOSE.LEFT_HEEL
          ? -0.1 * scale * Math.sin(heelRiseDeg * DEG)
          : 0;
      const nearIndex = isRightNear ? leftIndex + 1 : leftIndex;
      const farIndex = isRightNear ? leftIndex : leftIndex + 1;
      const point = add(base, [offset[0], offset[1] + lift]);
      skeleton.set(nearIndex, { point, isFar: view === "side" });
      skeleton.set(farIndex, { point, isFar: view === "side" });
    }
    return skeleton;
  };

  const pullUpSkeleton = (p: number, t: number): Skeleton => {
    const skeleton: Skeleton = new Map();
    const barY = 0.15;
    const hangY = barY + 1.2 * torso;
    const peakY = barY + mouthBelowBar * torso;
    const mouthY = hangY + (peakY - hangY) * p;
    const sway = hipSwayRatio * torso * Math.sin((2 * Math.PI * t) / repSec);
    const tilt = Math.sin(shoulderTiltDeg * DEG) * (shoulderSpread / 2);
    const set = (index: number, point: P): void => {
      skeleton.set(index, { point, isFar: false });
    };
    const nose: P = [cx, mouthY - 0.05 * torso];
    set(BLAZEPOSE.NOSE, nose);
    set(BLAZEPOSE.MOUTH_LEFT, [cx - 0.02, mouthY]);
    set(BLAZEPOSE.MOUTH_RIGHT, [cx + 0.02, mouthY]);
    const shoulderY = mouthY + 0.25 * torso;
    for (const [
      sign,
      shoulderIdx,
      elbowIdx,
      wristIdx,
      hipIdx,
      kneeIdx,
      ankleIdx,
    ] of [
      [-1, 11, 13, 15, 23, 25, 27],
      [1, 12, 14, 16, 24, 26, 28],
    ] as const) {
      const shoulder: P = [
        cx + (sign * shoulderSpread) / 2,
        shoulderY + sign * -tilt,
      ];
      const wrist: P = [cx + sign * shoulderSpread * 0.75, barY];
      const flare =
        sign === -1
          ? Math.sin(elbowAsymmetryDeg * DEG) *
            0.5 *
            Math.hypot(shoulder[0] - wrist[0], shoulder[1] - wrist[1])
          : 0;
      const elbow = add(lerp(shoulder, wrist, 0.5), [sign * flare, 0]);
      const hip: P = [shoulder[0] + sway, shoulder[1] + torso];
      const ankle: P = [hip[0], shoulder[1] + scale];
      set(shoulderIdx, shoulder);
      set(elbowIdx, elbow);
      set(wristIdx, wrist);
      set(hipIdx, hip);
      set(kneeIdx, lerp(hip, ankle, 0.5));
      set(ankleIdx, ankle);
      set(ankleIdx + 2, add(ankle, [0, 0.01]));
      set(ankleIdx + 4, add(ankle, [0, 0.02]));
    }
    return skeleton;
  };

  const frames: PoseCapturePayload["frames"] = [];
  for (let i = 0; i < frameCount; i += 1) {
    const t = i / fps;
    const p = repProgress(t, leadSec, repSec, restSec, reps);
    const skeleton = sideOn ? sideOnSkeleton(p) : pullUpSkeleton(p, t);
    const isDropped = dropoutFrames.some(
      ([start, end]) => i >= start && i <= end,
    );
    const fallback = skeleton.get(BLAZEPOSE.NOSE)!.point;
    const keypoints: Keypoint[] = [];
    for (let index = 0; index < BLAZEPOSE_KEYPOINT_COUNT; index += 1) {
      const entry = skeleton.get(index);
      const point = entry?.point ?? fallback;
      const jitterX = noise ? (random() * 2 - 1) * noise : 0;
      const jitterY = noise ? (random() * 2 - 1) * noise : 0;
      const confidence = isDropped
        ? DROPPED_VISIBILITY
        : entry?.isFar
          ? FAR_VISIBILITY
          : visibility;
      keypoints.push([
        (point[0] + jitterX) / aspectRatio,
        point[1] + jitterY,
        confidence,
      ]);
    }
    frames.push({ timestampSec: t, keypoints });
  }

  return {
    version: 1,
    poseModelName: "blazepose",
    poseModelVersion: "synthetic",
    fps,
    frameCount,
    durationSec: frameCount / fps,
    cameraView: view,
    aspectRatio,
    frames,
  };
};
