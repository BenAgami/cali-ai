import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import {
  LlmError,
  type LlmProvider,
  type WorkoutPlanRequest,
  type WorkoutPlanResult,
} from "./types";

// Built per request so the model can only emit codes from the live catalog.
// The API ignores min/max, so ranges are re-validated server-side.
const buildPlanOutputSchema = (codes: [string, ...string[]]) =>
  z.object({
    name: z.string(),
    note: z.string().nullable(),
    exercises: z.array(
      z.object({
        exerciseCode: z.enum(codes),
        sets: z.number().int(),
        reps: z.number().int().nullable(),
        durationSecs: z.number().int().nullable(),
        restSecs: z.number().int(),
      }),
    ),
  });

const mapAnthropicError = (error: unknown): LlmError => {
  if (error instanceof Anthropic.RateLimitError) {
    return new LlmError("RATE_LIMITED", "Anthropic rate limited", {
      cause: error,
    });
  }
  if (
    error instanceof Anthropic.APIConnectionTimeoutError ||
    error instanceof Anthropic.APIUserAbortError ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return new LlmError("TIMEOUT", "Anthropic call timed out or aborted", {
      cause: error,
    });
  }
  if (error instanceof Anthropic.APIError) {
    return new LlmError("UNAVAILABLE", "Anthropic API unavailable", {
      cause: error,
    });
  }
  return new LlmError("INVALID_OUTPUT", "Unparsable model output", {
    cause: error,
  });
};

export class AnthropicProvider implements LlmProvider {
  constructor(private readonly client: Anthropic) {}

  async generateWorkoutPlan(
    req: WorkoutPlanRequest,
  ): Promise<WorkoutPlanResult> {
    let message;
    try {
      message = await this.client.messages.parse(
        {
          model: req.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: "user", content: req.userPrompt }],
          output_config: {
            format: zodOutputFormat(buildPlanOutputSchema(req.exerciseCodes)),
            effort: req.effort,
          },
        },
        { signal: req.signal, timeout: req.timeoutMs, maxRetries: 0 },
      );
    } catch (error) {
      throw mapAnthropicError(error);
    }

    if (message.stop_reason === "refusal") {
      throw new LlmError("REFUSAL", "Model refused the request");
    }
    if (message.stop_reason === "max_tokens") {
      throw new LlmError("INVALID_OUTPUT", "Model output was truncated");
    }
    if (!message.parsed_output) {
      throw new LlmError("INVALID_OUTPUT", "Model returned no parsed output");
    }

    return {
      plan: message.parsed_output,
      model: message.model,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  }
}
