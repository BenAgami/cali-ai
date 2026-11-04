import { getPrismaClient } from "@repo/db";
import type {
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
} from "../prompts/workoutPlanPrompt";
import { getUserIdByUuid } from "../utils/getUserIdByUuid";
import { toError } from "../utils/toError";
import {
  validateGeneratedPlan,
  type CatalogExercise,
} from "../utils/validateGeneratedPlan";

import aiPrerequisitesService from "./aiPrerequisitesService";

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
    const recent = await this.prisma.workoutGeneration.count({
      where: { userId, createdAt: { gte: new Date(now - DAY_MS) } },
    });
    if (recent >= env.aiGeneration.dailyCap) {
      throw new TooManyRequestsError(
        "Daily AI workout limit reached. Try again tomorrow.",
        "DAILY_LIMIT_REACHED",
      );
    }

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

    const catalog = await this.prisma.exercise.findMany({
      where: { isActive: true },
      select: { id: true, code: true, displayName: true, exerciseType: true },
      orderBy: { code: "asc" },
    });
    const [firstExercise] = catalog;
    if (!firstExercise) {
      throw new ServiceUnavailableError(
        "Exercise catalog is empty",
        "CATALOG_EMPTY",
      );
    }
    const catalogMap = new Map<string, CatalogExercise>(
      catalog.map((e) => [e.code.toLowerCase(), e]),
    );
    const exerciseCodes: [string, ...string[]] = [
      firstExercise.code,
      ...catalog.slice(1).map((e) => e.code),
    ];

    const generation = await this.prisma.workoutGeneration.create({
      data: {
        userId,
        goalText: input.goalText,
        promptVersion: WORKOUT_PLAN_PROMPT_VERSION,
      },
      select: { id: true },
    });
    const log = logger.child({ generationId: generation.id, userId });
    log.info({ goalTextLength: input.goalText.length }, "Generation started");

    const markFailed = async (errorCode: string, attempts: number) => {
      await this.prisma.workoutGeneration.update({
        where: { id: generation.id },
        data: {
          status: "FAILED",
          attempts,
          errorCode,
          completedAt: new Date(),
        },
      });
    };

    const controller = new AbortController();
    const deadline = setTimeout(
      () => controller.abort(),
      env.aiGeneration.deadlineMs,
    );
    let attemptsMade = 0;
    let finalised = false;

    try {
      const ladder = buildLadder();
      let previousIssues: string[] | undefined;

      for (const [index, attempt] of ladder.entries()) {
        if (controller.signal.aborted) break;
        attemptsMade = index + 1;

        try {
          const { system, user } = buildWorkoutPlanPrompt({
            experienceLevel: context.experienceLevel,
            goal: context.goal,
            heightCm: context.heightCm,
            weightKg: context.weightKg,
            goalText: input.goalText,
            catalog,
            previousIssues,
          });
          const result = await getLlmProvider().generateWorkoutPlan({
            model: attempt.model,
            effort: attempt.effort,
            maxTokens: env.llm.maxTokens,
            timeoutMs: attempt.timeoutMs,
            signal: controller.signal,
            system,
            user,
            exerciseCodes,
          });

          const validation = validateGeneratedPlan(
            result.plan,
            catalogMap,
            context.experienceLevel,
          );
          if (validation.ok) {
            await this.prisma.workoutGeneration.update({
              where: { id: generation.id },
              data: {
                status: "SUCCEEDED",
                model: result.model,
                attempts: attemptsMade,
                completedAt: new Date(),
              },
            });
            finalised = true;
            log.info(
              {
                attempt: attemptsMade,
                model: result.model,
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
              },
              "Generation succeeded",
            );
            return {
              generationId: generation.id,
              model: result.model,
              name: validation.plan.name,
              note: validation.plan.note,
              exercises: validation.plan.exercises,
            };
          }

          log.warn(
            { attempt: attemptsMade, model: attempt.model },
            "Generated plan failed validation",
          );
          previousIssues = validation.issues;
        } catch (error) {
          if (!(error instanceof LlmError)) throw error;

          if (error.code === "RATE_LIMITED" || error.code === "UNAVAILABLE") {
            const code =
              error.code === "RATE_LIMITED"
                ? "LLM_RATE_LIMITED"
                : "LLM_UNAVAILABLE";
            log.warn(
              { attempt: attemptsMade, code },
              "LLM provider unavailable",
            );
            await markFailed(code, attemptsMade);
            finalised = true;
            throw new ServiceUnavailableError(
              "The AI service is busy. Please try again shortly.",
              code,
            );
          }

          log.warn(
            { attempt: attemptsMade, model: attempt.model, code: error.code },
            "LLM attempt failed",
          );
          if (error.code !== "TIMEOUT") previousIssues = GENERIC_ISSUE;
        }
      }

      await markFailed("GENERATION_FAILED", ladder.length);
      finalised = true;
      throw new ServiceUnavailableError(
        "We couldn't generate a workout. Please try again.",
        "GENERATION_FAILED",
      );
    } catch (error) {
      if (!finalised) {
        try {
          await markFailed("INTERNAL", attemptsMade);
        } catch (updateError) {
          log.error(
            { err: toError(updateError) },
            "Failed to mark generation as failed",
          );
        }
      }
      throw error;
    } finally {
      clearTimeout(deadline);
    }
  }
}

export default new WorkoutGenerationService();
