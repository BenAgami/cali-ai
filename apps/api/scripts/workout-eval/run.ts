import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ExerciseSummary } from "@repo/common";

import { env } from "../../src/config/env";
import { getLlmProvider, LlmError } from "../../src/lib/llm";
import type { LlmEffort } from "../../src/lib/llm/types";
import {
  buildWorkoutPlanPrompt,
  WORKOUT_PLAN_PROMPT_VERSION,
} from "../../src/prompts/workoutPlanPrompt";
import { validateGeneratedPlan } from "../../src/utils/validateGeneratedPlan";
import {
  EVAL_CATALOG,
  EVAL_GOALS,
  EVAL_LEVELS,
  EVAL_NOTE_GOALS,
  EVAL_PROFILE,
} from "./goldenSet";

type CallRecord = {
  model: string;
  effort: LlmEffort;
  goal: string;
  level: (typeof EVAL_LEVELS)[number];
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  isSchemaValid: boolean;
  llmErrorCode: string | null;
  isCatalogValid: boolean;
  issues: string[];
  hasRest: boolean;
  hasNote: boolean;
  volume: number | null;
};

const out = (text: string) => process.stdout.write(`${text}\n`);

const catalogMap = new Map<string, ExerciseSummary>(
  EVAL_CATALOG.map((e) => [e.code, e]),
);
const exerciseCodes: [string, ...string[]] = [
  EVAL_CATALOG[0].code,
  ...EVAL_CATALOG.slice(1).map((e) => e.code),
];

const targets: Array<{ model: string; effort: LlmEffort; timeoutMs: number }> =
  [
    {
      model: env.llm.primaryModel,
      effort: env.llm.primaryEffort,
      timeoutMs: env.llm.primaryTimeoutMs,
    },
    {
      model: env.llm.fallbackModel,
      effort: env.llm.fallbackEffort,
      timeoutMs: env.llm.fallbackTimeoutMs,
    },
  ];

const formatPercent = (count: number, total: number) =>
  total === 0 ? "n/a" : `${Math.round((count / total) * 100)}%`;
const averageRounded = (values: number[]) =>
  values.length === 0
    ? 0
    : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
const medianRounded = (values: number[]) => {
  const sorted = [...values].sort((first, second) => first - second);
  return sorted.length === 0
    ? 0
    : Math.round(sorted[Math.floor((sorted.length - 1) / 2)]);
};

const runOne = async (
  target: (typeof targets)[number],
  goal: string,
  level: CallRecord["level"],
): Promise<CallRecord> => {
  const prompt = buildWorkoutPlanPrompt({
    experienceLevel: level,
    goal: EVAL_PROFILE.goal,
    heightCm: EVAL_PROFILE.heightCm,
    weightKg: EVAL_PROFILE.weightKg,
    goalText: goal,
    catalog: EVAL_CATALOG,
  });

  const record: CallRecord = {
    model: target.model,
    effort: target.effort,
    goal,
    level,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
    isSchemaValid: false,
    llmErrorCode: null,
    isCatalogValid: false,
    issues: [],
    hasRest: false,
    hasNote: false,
    volume: null,
  };

  const start = performance.now();
  try {
    const result = await getLlmProvider().generateWorkoutPlan({
      model: target.model,
      effort: target.effort,
      maxTokens: env.llm.maxTokens,
      timeoutMs: target.timeoutMs,
      signal: AbortSignal.timeout(target.timeoutMs),
      system: prompt.system,
      userPrompt: prompt.userPrompt,
      exerciseCodes,
    });
    record.latencyMs = Math.round(performance.now() - start);
    record.isSchemaValid = true;
    record.inputTokens = result.usage.inputTokens;
    record.outputTokens = result.usage.outputTokens;
    record.hasNote = result.plan.note !== null && result.plan.note !== "";
    record.hasRest = result.plan.exercises.every((e) => e.restSecs >= 30);
    record.volume = result.plan.exercises.reduce(
      (sum, e) => sum + e.sets * (e.reps ?? (e.durationSecs ?? 0) / 3),
      0,
    );

    const validation = validateGeneratedPlan(result.plan, catalogMap, level);
    record.isCatalogValid = validation.ok;
    if (!validation.ok) record.issues = validation.issues;
  } catch (error) {
    record.latencyMs = Math.round(performance.now() - start);
    record.llmErrorCode =
      error instanceof LlmError
        ? error.code
        : `UNEXPECTED: ${error instanceof Error ? error.message : String(error)}`;
  }
  return record;
};

const main = async () => {
  const records: CallRecord[] = [];

  for (const target of targets) {
    for (const goal of EVAL_GOALS) {
      for (const level of EVAL_LEVELS) {
        const callRecord = await runOne(target, goal, level);
        records.push(callRecord);
        out(
          `${target.model} | ${goal} | ${level} | ${callRecord.latencyMs}ms | ${
            callRecord.llmErrorCode ??
            (callRecord.isCatalogValid ? "ok" : "invalid")
          }`,
        );
      }
    }
  }

  const summary = targets.map((target) => {
    const targetRecords = records.filter(
      (record) => record.model === target.model,
    );
    const schemaValidRecords = targetRecords.filter(
      (record) => record.isSchemaValid,
    );
    const isVolumeHigherForAdvancedByGoal = EVAL_GOALS.map((goal) => {
      const beginnerRecord = targetRecords.find(
        (record) => record.goal === goal && record.level === "BEGINNER",
      );
      const advancedRecord = targetRecords.find(
        (record) => record.goal === goal && record.level === "ADVANCED",
      );
      return (
        beginnerRecord?.volume != null &&
        advancedRecord?.volume != null &&
        advancedRecord.volume > beginnerRecord.volume
      );
    });
    const noteGoalRecords = targetRecords.filter((record) =>
      EVAL_NOTE_GOALS.has(record.goal),
    );
    return {
      model: target.model,
      effort: target.effort,
      calls: targetRecords.length,
      schemaValid: formatPercent(
        schemaValidRecords.length,
        targetRecords.length,
      ),
      catalogValid: formatPercent(
        targetRecords.filter((record) => record.isCatalogValid).length,
        targetRecords.length,
      ),
      restPresent: formatPercent(
        schemaValidRecords.filter((record) => record.hasRest).length,
        schemaValidRecords.length,
      ),
      levelDiffers: formatPercent(
        isVolumeHigherForAdvancedByGoal.filter(Boolean).length,
        isVolumeHigherForAdvancedByGoal.length,
      ),
      noteOnHandstandAndKnee: formatPercent(
        noteGoalRecords.filter((record) => record.hasNote).length,
        noteGoalRecords.length,
      ),
      p50LatencyMs: medianRounded(
        targetRecords.map((record) => record.latencyMs),
      ),
      maxLatencyMs: Math.max(
        0,
        ...targetRecords.map((record) => record.latencyMs),
      ),
      meanInputTokens: averageRounded(
        schemaValidRecords.map((record) => record.inputTokens ?? 0),
      ),
      meanOutputTokens: averageRounded(
        schemaValidRecords.map((record) => record.outputTokens ?? 0),
      ),
    };
  });

  out("");
  out(`Prompt version: ${WORKOUT_PLAN_PROMPT_VERSION}`);
  for (const targetSummary of summary) {
    out("");
    for (const [metric, value] of Object.entries(targetSummary)) {
      out(`  ${metric.padEnd(24)} ${value}`);
    }
  }

  const resultsDir = path.join(import.meta.dirname, "results");
  await mkdir(resultsDir, { recursive: true });
  const resultsFile = path.join(
    resultsDir,
    `${new Date().toISOString().replace(/:/g, "-")}.json`,
  );
  await writeFile(
    resultsFile,
    JSON.stringify(
      { promptVersion: WORKOUT_PLAN_PROMPT_VERSION, summary, records },
      null,
      2,
    ),
  );
  out(`\nResults written to ${resultsFile}`);
};

await main();
