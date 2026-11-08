import { z } from "zod";

import { ANALYSIS_STAGES, SESSION_STATUSES } from "./analysis";

export const FORM_ANALYSIS_EXERCISES = [
  "push_up",
  "pull_up",
  "dip",
  "squat",
] as const;

export type FormAnalysisExercise = (typeof FORM_ANALYSIS_EXERCISES)[number];

export const isFormAnalysisExercise = (
  code: string,
): code is FormAnalysisExercise =>
  (FORM_ANALYSIS_EXERCISES as readonly string[]).indexOf(code) !== -1;

export type FormCameraView = "side" | "front" | "back";
export type FormCaptureOrientation = "portrait" | "landscape";

export const FORM_CAPTURE_SETUP: Record<
  FormAnalysisExercise,
  { cameraView: "side" | "front"; orientation: FormCaptureOrientation }
> = {
  push_up: { cameraView: "side", orientation: "landscape" },
  dip: { cameraView: "side", orientation: "landscape" },
  squat: { cameraView: "side", orientation: "portrait" },
  pull_up: { cameraView: "front", orientation: "portrait" },
};

export const BLAZEPOSE_KEYPOINT_COUNT = 33;

export const BLAZEPOSE = {
  NOSE: 0,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/** Side-on exercises check one side (near side); pull_up (front/back) requires both. */
export const FORM_KEY_JOINTS: Record<
  FormAnalysisExercise,
  { left: readonly number[]; right: readonly number[] }
> = {
  push_up: { left: [11, 13, 15, 23, 27], right: [12, 14, 16, 24, 28] },
  dip: { left: [11, 13, 15, 23, 25], right: [12, 14, 16, 24, 26] },
  squat: { left: [11, 23, 25, 27], right: [12, 24, 26, 28] },
  pull_up: { left: [9, 11, 13, 15, 23], right: [10, 12, 14, 16, 24] },
};

export const FORM_BANDS = [
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "NEEDS_WORK",
  "POOR",
] as const;

export type FormBand = (typeof FORM_BANDS)[number];

export const FORM_BAND_LABELS: Record<FormBand, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
  NEEDS_WORK: "Needs work",
  POOR: "Poor",
};

export const FORM_BAND_MIN_SCORE: Record<FormBand, number> = {
  EXCELLENT: 90,
  GOOD: 75,
  FAIR: 60,
  NEEDS_WORK: 40,
  POOR: 0,
};

export const bandFromScore = (score: number): FormBand => {
  const rounded = Math.min(100, Math.max(0, Math.round(score)));
  for (const band of FORM_BANDS) {
    if (FORM_BAND_MIN_SCORE[band] <= rounded) return band;
  }
  return "POOR";
};

export const FORM_DIMENSIONS = ["ROM", "CORE", "SYMMETRY"] as const;
export type FormDimension = (typeof FORM_DIMENSIONS)[number];

export const FORM_DIMENSION_LABELS: Record<FormDimension, string> = {
  ROM: "Range of motion",
  CORE: "Core stability",
  SYMMETRY: "Symmetry",
};

export const ANALYSIS_OUTCOMES = ["SCORED", "UNTRACKABLE"] as const;
export type AnalysisOutcome = (typeof ANALYSIS_OUTCOMES)[number];

export const UNTRACKABLE_REASONS = [
  "TOO_FEW_FRAMES",
  "LOW_CONFIDENCE",
  "KEY_JOINTS_HIDDEN",
  "OUT_OF_FRAME",
  "TOO_FAR",
  "WRONG_VIEW",
  "NO_REPS_DETECTED",
] as const;

export type UntrackableReason = (typeof UNTRACKABLE_REASONS)[number];

export const UNTRACKABLE_ADVICE: Record<UntrackableReason, string> = {
  TOO_FEW_FRAMES:
    "The recording was too short. Record the whole set, at least a few seconds.",
  LOW_CONFIDENCE:
    "We couldn't see you clearly. Add light and wear clothes that stand out from the background.",
  KEY_JOINTS_HIDDEN:
    "Part of your body was hidden. Make sure nothing blocks the camera's view of your arms and legs.",
  OUT_OF_FRAME:
    "You moved out of the frame. Step back so your whole body stays in view for every rep.",
  TOO_FAR:
    "You were too far from the camera. Move closer so your body fills more of the frame.",
  WRONG_VIEW: "The camera angle didn't match this exercise.",
  NO_REPS_DETECTED:
    "We couldn't count at least 2 full reps. Do at least 2 complete reps in view.",
};

export const FORM_VIEW_HINTS: Record<FormAnalysisExercise, string> = {
  push_up: "Place the phone at hip height, side-on to you, in landscape.",
  dip: "Place the phone at hip height, side-on to you, in landscape.",
  squat: "Place the phone at hip height, side-on to you, in portrait.",
  pull_up:
    "Face the camera (or face away), phone in portrait, far enough back to see your hands on the bar and your feet.",
};

const VIEW_HINT_REASONS: readonly UntrackableReason[] = [
  "WRONG_VIEW",
  "OUT_OF_FRAME",
  "TOO_FAR",
];

/** Advice strings in reason order, deduped; the view hint is appended once when WRONG_VIEW, OUT_OF_FRAME or TOO_FAR is present. */
export const buildUntrackableAdvice = (
  reasons: readonly UntrackableReason[],
  exerciseCode: FormAnalysisExercise,
): string[] => {
  const unique = reasons.filter(
    (reason, index) => reasons.indexOf(reason) === index,
  );
  const advice = unique.map((reason) => UNTRACKABLE_ADVICE[reason]);
  if (unique.some((reason) => VIEW_HINT_REASONS.indexOf(reason) !== -1)) {
    advice.push(FORM_VIEW_HINTS[exerciseCode]);
  }
  return advice;
};

const repNumbersSchema = z.array(z.number().int().min(1));

export const formPositiveSchema = z.object({
  text: z.string(),
  repNumbers: repNumbersSchema,
});

export const formCorrectionSchema = z.object({
  code: z.string(),
  title: z.string(),
  cue: z.string(),
  detail: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  repNumbers: repNumbersSchema,
});

export const formDimensionResultSchema = z.object({
  dimension: z.enum(FORM_DIMENSIONS),
  band: z.enum(FORM_BANDS).nullable(),
  isAssessed: z.boolean(),
});

const analysisBase = {
  sessionId: z.number().int(),
  workoutId: z.number().int().nullable(),
  setNumber: z.number().int().nullable(),
  exerciseCode: z.string(),
  exerciseDisplayName: z.string(),
  analyzedAt: z.string(),
};

export const formAnalysisResponseSchema = z.discriminatedUnion("outcome", [
  z.object({
    ...analysisBase,
    outcome: z.literal("SCORED"),
    band: z.enum(FORM_BANDS),
    repCount: z.number().int().min(0),
    summary: z.string(),
    dimensions: z.array(formDimensionResultSchema).length(3),
    positives: z.array(formPositiveSchema).min(1),
    corrections: z.array(formCorrectionSchema).max(2),
  }),
  z.object({
    ...analysisBase,
    outcome: z.literal("UNTRACKABLE"),
    reasons: z.array(z.enum(UNTRACKABLE_REASONS)).min(1),
    advice: z.array(z.string()).min(1),
  }),
]);

export type FormAnalysisResponse = z.infer<typeof formAnalysisResponseSchema>;

export const recordedSetSchema = z.object({
  sessionId: z.number().int(),
  workoutId: z.number().int(),
  setNumber: z.number().int().nullable(),
  exerciseCode: z.string(),
  exerciseDisplayName: z.string(),
  performedAt: z.string(),
  processingStatus: z.enum(SESSION_STATUSES),
  analysisStage: z.enum(ANALYSIS_STAGES).nullable(),
  analysisStageProgress: z.number().nullable(),
  failureReason: z.string().nullable(),
  bullmqJobId: z.string().nullable(),
  outcome: z.enum(ANALYSIS_OUTCOMES).nullable(),
  band: z.enum(FORM_BANDS).nullable(),
});

export type RecordedSet = z.infer<typeof recordedSetSchema>;

export const recordedSetListSchema = z.array(recordedSetSchema);
