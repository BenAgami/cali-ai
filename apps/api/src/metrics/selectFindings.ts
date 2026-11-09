import {
  FORM_BAND_LABELS,
  FORM_DIMENSION_LABELS,
  FORM_DIMENSIONS,
  type FormDimension,
} from "@repo/common";

import { mean, std } from "./geometry";
import type { ExerciseRubric } from "./rubrics/types";
import type {
  DetectedFinding,
  DimensionScore,
  FindingSeverity,
  PositiveCandidate,
  RepMetrics,
} from "./types";

// 05-RUBRICS section 8
const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};
const MAX_CORRECTIONS = 2;
const MAX_FEATURE_POSITIVES = 2;
const MAX_TEMPO_CV = 0.25;
const DETECTION_FRACTION = 0.4;
const FRACTION_EPSILON = 1e-9;

const rankOf = (finding: DetectedFinding): number =>
  SEVERITY_WEIGHT[finding.severity] * finding.affectedFraction;

const compareFindings = (a: DetectedFinding, b: DetectedFinding): number =>
  rankOf(b) - rankOf(a) ||
  FORM_DIMENSIONS.indexOf(a.dimension) - FORM_DIMENSIONS.indexOf(b.dimension) ||
  (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0);

export const detectFindings = (
  reps: RepMetrics[],
  rubric: ExerciseRubric,
): DetectedFinding[] => {
  const repCount = reps.length;
  const minAffected = Math.max(
    1,
    Math.ceil(DETECTION_FRACTION * repCount - FRACTION_EPSILON),
  );
  const findings: DetectedFinding[] = [];

  for (const rule of rubric.repTags) {
    const affected = reps.flatMap((rep) => {
      const hit = rep.tags.find((t) => t.tag === rule.tag);
      return hit ? [{ repNumber: rep.repNumber, severity: hit.severity }] : [];
    });
    if (affected.length < minAffected) continue;
    const severity = affected.reduce<FindingSeverity>(
      (worst, a) =>
        SEVERITY_WEIGHT[a.severity] > SEVERITY_WEIGHT[worst]
          ? a.severity
          : worst,
      "LOW",
    );
    findings.push({
      tag: rule.tag,
      dimension: rule.dimension,
      severity,
      label: rule.label,
      cue: rule.cue,
      repNumbers: affected.map((a) => a.repNumber),
      affectedFraction: affected.length / repCount,
    });
  }

  for (const rule of rubric.setTags) {
    const result = rule.evaluate(reps);
    if (!result) continue;
    findings.push({
      tag: rule.tag,
      dimension: rule.dimension,
      severity: result.severity,
      label: rule.label,
      cue: rule.cue,
      repNumbers: result.repNumbers,
      affectedFraction: result.repNumbers.length / repCount,
    });
  }
  return findings;
};

export const selectCorrections = (
  findings: DetectedFinding[],
): DetectedFinding[] => {
  const ranked = [...findings].sort(compareFindings);
  const dimensions = new Set<FormDimension>(ranked.map((f) => f.dimension));
  if (dimensions.size <= 1) return ranked.slice(0, MAX_CORRECTIONS);

  const seen = new Set<FormDimension>();
  const onePerDimension = ranked.filter((finding) => {
    if (seen.has(finding.dimension)) return false;
    seen.add(finding.dimension);
    return true;
  });
  return onePerDimension.slice(0, MAX_CORRECTIONS);
};

export const buildPositives = (
  reps: RepMetrics[],
  dimensions: Record<FormDimension, DimensionScore>,
  rubric: ExerciseRubric,
): PositiveCandidate[] => {
  const allReps = reps.map((rep) => rep.repNumber);
  const featurePositives: PositiveCandidate[] = [];

  for (const dimension of FORM_DIMENSIONS) {
    const { band, isAssessed } = dimensions[dimension];
    if (isAssessed && (band === "EXCELLENT" || band === "GOOD")) {
      featurePositives.push({
        kind: "DIMENSION_GOOD",
        text: `Your ${FORM_DIMENSION_LABELS[dimension].toLowerCase()} was ${FORM_BAND_LABELS[band].toLowerCase()} across the set.`,
        repNumbers: allReps,
      });
    }
  }

  const { depthFeature, depthStdMax, fullRangeTags, rushedTag } =
    rubric.positives;
  const hasTag = (tags: string[]): boolean =>
    reps.some((rep) => rep.tags.some((t) => tags.indexOf(t.tag) !== -1));

  if (!hasTag(fullRangeTags)) {
    featurePositives.push({
      kind: "FULL_RANGE",
      text: "You finished every rep at full extension.",
      repNumbers: allReps,
    });
  }

  const depths = reps
    .map((rep) => rep.features[depthFeature])
    .filter((value) => Number.isFinite(value));
  if (depths.length >= 2 && std(depths) < depthStdMax) {
    featurePositives.push({
      kind: "CONSISTENT_DEPTH",
      text: "Your depth was consistent from rep to rep.",
      repNumbers: allReps,
    });
  }

  const durations = reps.map((rep) => rep.durationSec);
  const durationMean = mean(durations);
  const isRushed = rushedTag !== null && hasTag([rushedTag]);
  if (
    !isRushed &&
    durations.length >= 2 &&
    durationMean > 0 &&
    std(durations) / durationMean < MAX_TEMPO_CV
  ) {
    featurePositives.push({
      kind: "STEADY_TEMPO",
      text: "You kept a steady, controlled pace.",
      repNumbers: allReps,
    });
  }

  return [
    ...featurePositives.slice(0, MAX_FEATURE_POSITIVES),
    {
      kind: "COMPLETED_REPS",
      text: `You finished ${reps.length} reps.`,
      repNumbers: allReps,
    },
  ];
};
