import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import {
  FORM_ANALYSIS_EXERCISES,
  type FormAnalysisExercise,
  type PoseCapturePayload,
  poseCapturePayloadSchema,
} from "@repo/common";
import { z } from "zod";

const FIXTURE_DIR = fileURLToPath(
  new URL("../metrics/fixtures/", import.meta.url),
);

const manifestSchema = z.array(
  z.object({
    file: z.string().min(1),
    exercise: z.enum(FORM_ANALYSIS_EXERCISES),
    clip: z.string().min(1),
    kind: z.enum(["reps", "hold"]),
    view: z.enum(["side", "front", "back", "diag45"]),
    light: z.enum(["normal", "dim"]),
    expectedReps: z.number().int().min(0),
  }),
);

export type PoseFixtureEntry = {
  file: string;
  exercise: FormAnalysisExercise;
  clip: string;
  kind: "reps" | "hold";
  view: "side" | "front" | "back" | "diag45";
  light: "normal" | "dim";
  expectedReps: number;
};

export const listPoseFixtures = (): PoseFixtureEntry[] =>
  manifestSchema.parse(
    JSON.parse(readFileSync(path.join(FIXTURE_DIR, "manifest.json"), "utf8")),
  );

export const loadPoseFixture = (entry: PoseFixtureEntry): PoseCapturePayload =>
  poseCapturePayloadSchema.parse(
    JSON.parse(
      gunzipSync(readFileSync(path.join(FIXTURE_DIR, entry.file))).toString(
        "utf8",
      ),
    ),
  );
