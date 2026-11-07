import { getPrismaClient } from "@repo/db";
import type {
  ExerciseSummary,
  GenerateWorkoutValues,
  WorkoutGenerationPreview,
} from "@repo/common";

import { env } from "../config/env";
import {
  ConflictError,
  ServiceUnavailableError,
  TooManyRequestsError,
} from "../errors";
import { getLlmProvider, LlmError } from "../lib/llm";
import type { LlmEffort } from "../lib/llm/types";
import { logger } from "../lib/logger";
import {
  buildWorkoutPlanPrompt,
  WORKOUT_PLAN_PROMPT_VERSION,
  type PromptCatalogEntry,
} from "../prompts/workoutPlanPrompt";
import { getUserIdByUuid } from "../utils/getUserIdByUuid";
import { toError } from "../utils/toError";
import { validateGeneratedPlan } from "../utils/validateGeneratedPlan";

import aiPrerequisitesService, {
  type AiUserContext,
} from "./aiPrerequisitesService";

const DAY_MS = 24 * 60 * 60 * 1000;

type Attempt = { model: string; effort: LlmEffort; timeoutMs: number };

const buildLadder = (): Attempt[] => {
  const primary: Attempt = {
    model: env.llm.primaryModel,
    effort: env.llm.primaryEffort,
    timeoutMs: env.llm.primaryTimeoutMs,
  };
  const fallback: Attempt = {
    model: env.llm.fallbackModel,
    effort: env.llm.fallbackEffort,
    timeoutMs: env.llm.fallbackTimeoutMs,
  };
  return [primary, primary, fallback];
};

const GENERIC_ISSUE = ["The previous response was not a valid plan"];

type Catalog = {
  entries: PromptCatalogEntry[];
  byCode: Map<string, ExerciseSummary>;
  codes: [string, ...string[]];
};

const createRunLogger = (generationId: number, userId: number) =>
  logger.child({ generationId, userId });

type GenerationRun = {
  id: number;
  log: ReturnType<typeof createRunLogger>;
  context: AiUserContext;
  goalText: string;
  catalog: Catalog;
  signal: AbortSignal;
  attemptsMade: number;
  finalised: boolean;
};

type AttemptOutcome =
  | { preview: WorkoutGenerationPreview }
  | { issues: string[] };

export class WorkoutGenerationService {
  private get prisma() {
    return getPrismaClient();
  }

  async generate(
    userUuid: string,
    input: GenerateWorkoutValues,
  ): Promise<WorkoutGenerationPreview> {
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    const context = await aiPrerequisitesService.assertAiPrerequisites(userId);

    const now = Date.now();
    await this.assertUnderDailyCap(userId, now);
    await this.assertNoneInFlight(userId, now);
    const catalog = await this.loadCatalog();

    const generation = await this.prisma.workoutGeneration.create({
      data: {
        userId,
        goalText: input.goalText,
        promptVersion: WORKOUT_PLAN_PROMPT_VERSION,
      },
      select: { id: true },
    });
    const log = createRunLogger(generation.id, userId);
    log.info({ goalTextLength: input.goalText.length }, "Generation started");

    const controller = new AbortController();
    const deadline = setTimeout(
      () => controller.abort(),
      env.aiGeneration.deadlineMs,
    );
    const run: GenerationRun = {
      id: generation.id,
      log,
      context,
      goalText: input.goalText,
      catalog,
      signal: controller.signal,
      attemptsMade: 0,
      finalised: false,
    };

    try {
      return await this.runAttempts(run);
    } catch (error) {
      if (!run.finalised) await this.markUnexpectedFailure(run);
      throw error;
    } finally {
      clearTimeout(deadline);
    }
  }

  private async assertUnderDailyCap(userId: number, now: number) {
    const generatedLast24hCount = await this.prisma.workoutGeneration.count({
      where: { userId, createdAt: { gte: new Date(now - DAY_MS) } },
    });
    if (generatedLast24hCount >= env.aiGeneration.dailyCap) {
      throw new TooManyRequestsError(
        "Daily AI workout limit reached. Try again tomorrow.",
        "DAILY_LIMIT_REACHED",
      );
    }
  }

  private async assertNoneInFlight(userId: number, now: number) {
    const inFlight = await this.prisma.workoutGeneration.findFirst({
      where: {
        userId,
        status: "PENDING",
        createdAt: { gte: new Date(now - env.aiGeneration.deadlineMs) },
      },
      select: { id: true },
    });
    if (inFlight) {
      throw new ConflictError(
        "A workout is already being generated",
        "GENERATION_IN_PROGRESS",
      );
    }
  }

  private async loadCatalog(): Promise<Catalog> {
    const entries = await this.prisma.exercise.findMany({
      where: { isActive: true },
      select: { id: true, code: true, displayName: true, exerciseType: true },
      orderBy: { code: "asc" },
    });
    const [first, ...rest] = entries;
    if (!first) {
      throw new ServiceUnavailableError(
        "Exercise catalog is empty",
        "CATALOG_EMPTY",
      );
    }
    return {
      entries,
      byCode: new Map<string, ExerciseSummary>(
        entries.map((e) => [e.code.toLowerCase(), e]),
      ),
      codes: [first.code, ...rest.map((e) => e.code)],
    };
  }

  private async runAttempts(
    run: GenerationRun,
  ): Promise<WorkoutGenerationPreview> {
    const ladder = buildLadder();
    let previousIssues: string[] | undefined;

    for (const [index, attempt] of ladder.entries()) {
      if (run.signal.aborted) break;
      run.attemptsMade = index + 1;

      try {
        const outcome = await this.tryAttempt(run, attempt, previousIssues);
        if ("preview" in outcome) return outcome.preview;
        previousIssues = outcome.issues;
      } catch (error) {
        if (!(error instanceof LlmError)) throw error;
        previousIssues =
          (await this.handleLlmError(run, attempt, error)) ?? previousIssues;
      }
    }

    await this.markFailed(run, "GENERATION_FAILED", ladder.length);
    throw new ServiceUnavailableError(
      "We couldn't generate a workout. Please try again.",
      "GENERATION_FAILED",
    );
  }

  private async tryAttempt(
    run: GenerationRun,
    attempt: Attempt,
    previousIssues: string[] | undefined,
  ): Promise<AttemptOutcome> {
    const { context, catalog } = run;
    const { system, userPrompt } = buildWorkoutPlanPrompt({
      experienceLevel: context.experienceLevel,
      goal: context.goal,
      heightCm: context.heightCm,
      weightKg: context.weightKg,
      goalText: run.goalText,
      catalog: catalog.entries,
      previousIssues,
    });
    const result = await getLlmProvider().generateWorkoutPlan({
      model: attempt.model,
      effort: attempt.effort,
      maxTokens: env.llm.maxTokens,
      timeoutMs: attempt.timeoutMs,
      signal: run.signal,
      system,
      userPrompt,
      exerciseCodes: catalog.codes,
    });

    const validation = validateGeneratedPlan(
      result.plan,
      catalog.byCode,
      context.experienceLevel,
    );
    if (!validation.ok) {
      run.log.warn(
        { attempt: run.attemptsMade, model: attempt.model },
        "Generated plan failed validation",
      );
      return { issues: validation.issues };
    }

    await this.prisma.workoutGeneration.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        model: result.model,
        attempts: run.attemptsMade,
        completedAt: new Date(),
      },
    });
    run.finalised = true;
    run.log.info(
      {
        attempt: run.attemptsMade,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
      "Generation succeeded",
    );
    return {
      preview: {
        generationId: run.id,
        model: result.model,
        name: validation.plan.name,
        note: validation.plan.note,
        exercises: validation.plan.exercises,
      },
    };
  }

  private async handleLlmError(
    run: GenerationRun,
    attempt: Attempt,
    error: LlmError,
  ): Promise<string[] | undefined> {
    if (error.code === "RATE_LIMITED" || error.code === "UNAVAILABLE") {
      const code =
        error.code === "RATE_LIMITED" ? "LLM_RATE_LIMITED" : "LLM_UNAVAILABLE";
      run.log.warn(
        { attempt: run.attemptsMade, code },
        "LLM provider unavailable",
      );
      await this.markFailed(run, code, run.attemptsMade);
      throw new ServiceUnavailableError(
        "The AI service is busy. Please try again shortly.",
        code,
      );
    }

    run.log.warn(
      { attempt: run.attemptsMade, model: attempt.model, code: error.code },
      "LLM attempt failed",
    );
    return error.code === "TIMEOUT" ? undefined : GENERIC_ISSUE;
  }

  private async markFailed(
    run: GenerationRun,
    errorCode: string,
    attempts: number,
  ) {
    await this.prisma.workoutGeneration.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        attempts,
        errorCode,
        completedAt: new Date(),
      },
    });
    run.finalised = true;
  }

  private async markUnexpectedFailure(run: GenerationRun) {
    try {
      await this.markFailed(run, "INTERNAL", run.attemptsMade);
    } catch (updateError) {
      run.log.error(
        { err: toError(updateError) },
        "Failed to mark generation as failed",
      );
    }
  }
}

export default new WorkoutGenerationService();
