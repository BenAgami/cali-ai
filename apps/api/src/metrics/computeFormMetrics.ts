import {
  bandFromScore,
  type FormAnalysisExercise,
  type PoseCapturePayload,
} from "@repo/common";

import { chooseNearSide, toPoseSeries } from "./preprocess";
import { getRubric, RUBRIC_VERSION } from "./rubrics";
import { buildDimensions, computeOverall } from "./scoring";
import { segmentReps } from "./segmentReps";
import {
  buildPositives,
  detectFindings,
  selectCorrections,
} from "./selectFindings";
import { checkTrackability, MIN_REPS_FOR_BAND } from "./trackability";
import {
  METRICS_VERSION,
  type FormMetrics,
  type RepMetrics,
  type UntrackableFormMetrics,
} from "./types";

const untrackable = (
  exerciseCode: FormAnalysisExercise,
  reasons: UntrackableFormMetrics["reasons"],
): UntrackableFormMetrics => ({
  outcome: "UNTRACKABLE",
  exerciseCode,
  reasons,
  metricsVersion: METRICS_VERSION,
  rubricVersion: RUBRIC_VERSION,
});

/**
 * Pure pipeline from an on-device pose capture to score, band, findings and
 * positives. Throws UnsupportedCaptureError for non-BlazePose payloads.
 */
export const computeFormMetrics = (
  payload: PoseCapturePayload,
  exerciseCode: FormAnalysisExercise,
): FormMetrics => {
  const series = toPoseSeries(payload, exerciseCode);

  const trackability = checkTrackability(payload, series);
  if (!trackability.isTrackable) {
    return untrackable(exerciseCode, trackability.reasons);
  }

  const side = exerciseCode === "pull_up" ? null : chooseNearSide(series);
  const rubric = getRubric(exerciseCode);
  const context = rubric.buildSetContext(series, side);
  const { signal, params } = rubric.primarySignal(series, side, context);
  const segmentation = segmentReps(signal, series.timestampsSec, params);
  if (segmentation.reps.length < MIN_REPS_FOR_BAND) {
    return untrackable(exerciseCode, ["NO_REPS_DETECTED"]);
  }

  const reps: RepMetrics[] = segmentation.reps.map((rep) => {
    const features = rubric.extractFeatures(series, rep, side, context);
    return {
      repNumber: rep.repNumber,
      startSec: rep.startSec,
      endSec: rep.endSec,
      durationSec: rep.durationSec,
      features,
      dimensionScores: rubric.scoreRep(features),
      tags: rubric.repTags.flatMap((rule) => {
        const severity = rule.evaluate(features);
        return severity ? [{ tag: rule.tag, severity }] : [];
      }),
    };
  });

  const dimensions = buildDimensions(reps, rubric);
  const overallScore = computeOverall(dimensions, rubric.weights);

  return {
    outcome: "SCORED",
    exerciseCode,
    cameraView: series.cameraView,
    side,
    repCount: reps.length,
    droppedRepCount: segmentation.droppedRepCount,
    reps,
    dimensions,
    overallScore,
    band: bandFromScore(overallScore),
    corrections: selectCorrections(detectFindings(reps, rubric)),
    positives: buildPositives(reps, dimensions, rubric),
    forbiddenTopics: rubric.forbiddenTopics,
    metricsVersion: METRICS_VERSION,
    rubricVersion: RUBRIC_VERSION,
  };
};
