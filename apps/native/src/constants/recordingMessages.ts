import { FORM_VIEW_HINTS, type SetupIssue } from "@repo/common";

export const SETUP_ISSUE_MESSAGES: Record<SetupIssue, string> = {
  NOT_DETECTED:
    "Step back so your whole body is in frame, and make sure the room is well lit",
  TOO_DARK: "Too dark - add light",
  CLIPPED_LEFT: "Move right - you're cut off at the left edge",
  CLIPPED_RIGHT: "Move left - you're cut off at the right edge",
  CLIPPED_TOP: "Step back - your head or hands are cut off",
  CLIPPED_BOTTOM: "Step back - your feet are cut off",
  TOO_FAR: "Move closer to the camera",
  WRONG_ANGLE: "Turn so the camera sees your side",
};

/** Pull-ups face the camera, so the generic "side" advice would be wrong. */
export const WRONG_ANGLE_PULL_UP_MESSAGE = FORM_VIEW_HINTS.pull_up;

export const UPLOAD_ERROR_MESSAGES = {
  UPLOAD_FAILED: "Upload failed. Check your connection and retry.",
  DAILY_LIMIT:
    "You've reached today's limit for form analysis. Try again tomorrow.",
  EXERCISE_LIMIT:
    "You've already analysed this exercise twice in this workout.",
} as const;

export type UploadErrorCode = keyof typeof UPLOAD_ERROR_MESSAGES;

export const RETRY_UPLOAD = "Retry upload";
export const STOP = "Stop";
export const COUNTDOWN_HINT = "Hold this position";

/**
 * Short spoken versions of the placement advice, for when the screen faces
 * away (back camera). Keyed like the on-screen messages, in landmark-frame terms
 * before the front-camera left/right swap.
 */
export const SPOKEN_ISSUE_MESSAGES: Record<SetupIssue, string> = {
  NOT_DETECTED: "Step back so your whole body is in frame",
  TOO_DARK: "Too dark, add light",
  CLIPPED_LEFT: "Move right",
  CLIPPED_RIGHT: "Move left",
  CLIPPED_TOP: "Step back, your head or hands are cut off",
  CLIPPED_BOTTOM: "Step back, your feet are cut off",
  TOO_FAR: "Move closer to the camera",
  WRONG_ANGLE: "Turn so the camera sees your side",
};

export const SPEECH_LANGUAGE = "en-US";
export const SPOKEN_RECORDING_STARTED = "Go";
export const SPOKEN_RECORDING_STOPPED = "Recording stopped";
