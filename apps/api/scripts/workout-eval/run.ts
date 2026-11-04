import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "../../src/config/env";
import { getLlmProvider, LlmError } from "../../src/lib/llm";
import type { LlmEffort } from "../../src/lib/llm/types";
import {
  buildWorkoutPlanPrompt,
  WORKOUT_PLAN_PROMPT_VERSION,
} from "../../src/prompts/workoutPlanPrompt";
import {
  validateGeneratedPlan,
  type CatalogExercise,
} from "../../src/utils/validateGeneratedPlan";
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
  schemaValid: boolean;
  llmErrorCode: string | null;
  catalogValid: boolean;
  issues: string[];
  restPresent: boolean;
  noteSet: boolean;
  volume: number | null;
};

const out = (text: string) => process.stdout.write(`${text}\n`);

const catalogMap = new Map<string, CatalogExercise>(
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

const pct = (n: number, d: number) =>
  d === 0 ? "n/a" : `${Math.round((n / d) * 100)}%`;
const mean = (xs: number[]) =>
  xs.length === 0 ? 0 : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
const p50 = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : Math.round(s[Math.floor((s.length - 1) / 2)]);
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
    schemaValid: false,
    llmErrorCode: null,
    catalogValid: false,
    issues: [],
    restPresent: false,
    noteSet: false,
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
      user: prompt.user,
      exerciseCodes,
    });
    record.latencyMs = Math.round(performance.now() - start);
    record.schemaValid = true;
    record.inputTokens = result.usage.inputTokens;
    record.outputTokens = result.usage.outputTokens;
    record.noteSet = result.plan.note !== null && result.plan.note !== "";
    record.restPresent = result.plan.exercises.every((e) => e.restSecs >= 30);
    record.volume = result.plan.exercises.reduce(
      (sum, e) => sum + e.sets * (e.reps ?? (e.durationSecs ?? 0) / 3),
      0,
    );

    const validation = validateGeneratedPlan(result.plan, catalogMap, level);
    record.catalogValid = validation.ok;
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
        const r = await runOne(target, goal, level);
        records.push(r);
        out(
          `${target.model} | ${goal} | ${level} | ${r.latencyMs}ms | ${
            r.llmErrorCode ?? (r.catalogValid ? "ok" : "invalid")
          }`,
        );
      }
    }
  }

  const summary = targets.map((target) => {
    const rs = records.filter((r) => r.model === target.model);
    const ok = rs.filter((r) => r.schemaValid);
    const pairs = EVAL_GOALS.map((goal) => {
      const b = rs.find((r) => r.goal === goal && r.level === "BEGINNER");
      const a = rs.find((r) => r.goal === goal && r.level === "ADVANCED");
      return b?.volume != null && a?.volume != null && a.volume > b.volume;
    });
    const noteRs = rs.filter((r) => EVAL_NOTE_GOALS.has(r.goal));
    const row = {
      model: target.model,
      effort: target.effort,
      calls: rs.length,
      schemaValid: pct(ok.length, rs.length),
      catalogValid: pct(rs.filter((r) => r.catalogValid).length, rs.length),
      restPresent: pct(ok.filter((r) => r.restPresent).length, ok.length),
      levelDiffers: pct(pairs.filter(Boolean).length, pairs.length),
      noteOnHandstandAndKnee: pct(
        noteRs.filter((r) => r.noteSet).length,
        noteRs.length,
      ),
      p50LatencyMs: p50(rs.map((r) => r.latencyMs)),
      maxLatencyMs: Math.max(0, ...rs.map((r) => r.latencyMs)),
      meanInputTokens: mean(ok.map((r) => r.inputTokens ?? 0)),
      meanOutputTokens: mean(ok.map((r) => r.outputTokens ?? 0)),
    };
    return row;
  });

  out("");
  out(`Prompt version: ${WORKOUT_PLAN_PROMPT_VERSION}`);
  for (const row of summary) {
    out("");
    for (const [k, v] of Object.entries(row)) out(`  ${k.padEnd(24)} ${v}`);
  }

  const dir = path.join(import.meta.dirname, "results");
  await mkdir(dir, { recursive: true });
  const file = path.join(
    dir,
    `${new Date().toISOString().replace(/:/g, "-")}.json`,
  );
  await writeFile(
    file,
    JSON.stringify(
      { promptVersion: WORKOUT_PLAN_PROMPT_VERSION, summary, records },
      null,
      2,
    ),
  );
  out(`\nResults written to ${file}`);
};

await main();
