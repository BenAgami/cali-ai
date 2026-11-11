import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import {
  FORM_DIMENSIONS,
  poseCapturePayloadSchema,
  type FormAnalysisExercise,
} from "@repo/common";

import { computeFormMetrics } from "../../src/metrics/computeFormMetrics";
import { RUBRIC_VERSION } from "../../src/metrics/rubrics";
import {
  METRICS_VERSION,
  type FormMetrics,
  type ScoredFormMetrics,
} from "../../src/metrics/types";

type ManifestEntry = {
  file: string;
  exercise: FormAnalysisExercise;
  clip: string;
  kind: "reps" | "hold";
  view: string;
  light: string;
  expectedReps: number;
};

type ClipResult = { entry: ManifestEntry; metrics: FormMetrics };

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(
  scriptDir,
  "../../tests/unit/metrics/fixtures",
);
const defaultOut = path.resolve(
  scriptDir,
  "../../../../.planning/phases/05-ai-form-analysis-camera-post-set/05-CALIBRATION.md",
);

const readArg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const loadManifest = (): ManifestEntry[] =>
  JSON.parse(
    readFileSync(path.join(fixturesDir, "manifest.json"), "utf8"),
  ) as ManifestEntry[];

const runClip = (entry: ManifestEntry): ClipResult => {
  const raw = gunzipSync(readFileSync(path.join(fixturesDir, entry.file)));
  const payload = poseCapturePayloadSchema.parse(
    JSON.parse(raw.toString("utf8")),
  );
  return { entry, metrics: computeFormMetrics(payload, entry.exercise) };
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

const clipName = (entry: ManifestEntry): string =>
  `${entry.exercise}/${entry.clip}`;

const dimensionCell = (
  metrics: ScoredFormMetrics,
  dimension: (typeof FORM_DIMENSIONS)[number],
): string => {
  const score = metrics.dimensions[dimension];
  return score.isAssessed && score.band ? score.band : "n/a";
};

const correctionList = (metrics: ScoredFormMetrics): string =>
  metrics.corrections.map((c) => `${c.tag}:${c.severity}`).join(", ") || "none";

const repsFound = (metrics: FormMetrics): string =>
  metrics.outcome === "SCORED"
    ? `${metrics.repCount} (${metrics.droppedRepCount} dropped)`
    : "0";

const plainLine = ({ entry, metrics }: ClipResult): string => {
  const head = `- **${clipName(entry)}** (${entry.view} view, ${entry.light} light)`;
  const expected =
    entry.kind === "hold" ? "a hold, no reps" : `${entry.expectedReps} reps`;
  if (metrics.outcome === "UNTRACKABLE") {
    return `${head}: expected ${expected}; no score given (${metrics.reasons.join(", ")}). The coach would ask for a re-record.`;
  }
  const coach =
    metrics.corrections.length === 0
      ? "nothing to fix"
      : metrics.corrections
          .map((c) => `"${c.cue}" (${c.label.toLowerCase()}, ${c.severity})`)
          .join("; ");
  return `${head}: expected ${expected}, found ${metrics.repCount}. Score ${metrics.overallScore}, band ${metrics.band}. Coach says: ${coach}.`;
};

const tableRow = ({ entry, metrics }: ClipResult): string => {
  const base = [
    clipName(entry),
    entry.view,
    entry.light,
    String(entry.expectedReps),
    metrics.outcome,
  ];
  if (metrics.outcome === "UNTRACKABLE") {
    return `| ${[...base, "0", "-", "-", "-", "-", "-", "-", metrics.reasons.join(", ")].join(" | ")} |`;
  }
  return `| ${[
    ...base,
    repsFound(metrics),
    String(metrics.overallScore),
    metrics.band,
    ...FORM_DIMENSIONS.map((d) => dimensionCell(metrics, d)),
    correctionList(metrics),
    "-",
  ].join(" | ")} |`;
};

const featuresBlock = ({ entry, metrics }: ClipResult): string => {
  if (metrics.outcome === "UNTRACKABLE") {
    return `- **${clipName(entry)}**: untrackable, no features`;
  }
  const names = [
    ...new Set(metrics.reps.flatMap((rep) => Object.keys(rep.features))),
  ].sort();
  const cells = names.map((name) => {
    const values = metrics.reps
      .map((rep) => rep.features[name])
      .filter((v) => Number.isFinite(v));
    return `${name}=${values.length ? median(values).toFixed(1) : "n/a"}`;
  });
  return `- **${clipName(entry)}**: ${cells.join(", ")}`;
};

const KNOWN_FINDINGS = `### Known findings from 05-14

- Every squat clip flags SQ_SHALLOW_DEPTH, which suggests the depth threshold is too strict for these takes (or the clips are genuinely shallow) and needs your judgement.
- Both side-on dip clips (dip/side_1, dip/side_2) score NEEDS_WORK; check whether those takes really looked that poor.
- dip/diag45_1 segments to 3 reps although 5 were performed, so the diagonal view likely confuses the rep counter.
`;

const renderReport = (results: ClipResult[], label: string, isFirst: boolean) =>
  [
    `## ${label}`,
    "",
    `Date: ${new Date().toISOString().slice(0, 10)} | METRICS_VERSION: ${METRICS_VERSION} | RUBRIC_VERSION: ${RUBRIC_VERSION}`,
    "",
    "### Plain-language summary",
    "",
    ...results.map(plainLine),
    "",
    ...(isFirst ? [KNOWN_FINDINGS] : []),
    "### Table",
    "",
    "| clip | view | light | expected reps | outcome | reps (dropped) | overall score | band | ROM | CORE | SYMMETRY | corrections | untrackable reasons |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...results.map(tableRow),
    "",
    "### Features appendix (median per rep)",
    "",
    ...results.map(featuresBlock),
    "",
  ].join("\n");

const main = async () => {
  const out = path.resolve(readArg("out") ?? defaultOut);
  const isAppend = process.argv.includes("--append");
  const label = readArg("label") ?? `Run 1 (${RUBRIC_VERSION})`;

  const results = loadManifest().map(runClip);
  const body = renderReport(results, label, !isAppend);

  await mkdir(path.dirname(out), { recursive: true });
  if (isAppend) {
    const existing = await readFile(out, "utf8");
    await writeFile(out, `${existing.trimEnd()}\n\n${body}`);
  } else {
    await writeFile(out, `# Form calibration report\n\n${body}`);
  }
  process.stdout.write(`Wrote ${results.length} clips to ${out}\n`);
};

await main();
