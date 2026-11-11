import { chooseNearSide, toPoseSeries } from "../../../src/metrics/preprocess";
import type { ExerciseRubric } from "../../../src/metrics/rubrics/types";
import { segmentReps } from "../../../src/metrics/segmentReps";
import type {
  RepFeatures,
  RepTag,
  SegmentationResult,
} from "../../../src/metrics/types";
import { buildSyntheticCapture, type SyntheticOptions } from "./syntheticPose";

export type RubricRun = {
  segmentation: SegmentationResult;
  features: RepFeatures[];
  tags: RepTag[][];
  scores: Array<ReturnType<ExerciseRubric["scoreRep"]>>;
};

/** Runs a rubric end to end over a synthetic capture (preprocess -> segment -> features). */
export const runRubric = (
  rubric: ExerciseRubric,
  options: Omit<SyntheticOptions, "exercise">,
  mutate?: (payload: ReturnType<typeof buildSyntheticCapture>) => void,
): RubricRun => {
  const payload = buildSyntheticCapture({
    exercise: rubric.exerciseCode,
    ...options,
  });
  mutate?.(payload);
  const series = toPoseSeries(payload, rubric.exerciseCode);
  const side =
    rubric.exerciseCode === "pull_up" ? null : chooseNearSide(series);
  const context = rubric.buildSetContext(series, side);
  const { signal, params } = rubric.primarySignal(series, side, context);
  const segmentation = segmentReps(signal, series.timestampsSec, params);
  const features = segmentation.reps.map((rep) =>
    rubric.extractFeatures(series, rep, side, context),
  );
  const tags = features.map((f) =>
    rubric.repTags.flatMap((rule) => {
      const severity = rule.evaluate(f);
      return severity ? [{ tag: rule.tag, severity }] : [];
    }),
  );
  return {
    segmentation,
    features,
    tags,
    scores: features.map((f) => rubric.scoreRep(f)),
  };
};

export const tagLabels = (run: RubricRun): string[][] =>
  run.tags.map((rep) => rep.map((t) => `${t.tag}:${t.severity}`));
