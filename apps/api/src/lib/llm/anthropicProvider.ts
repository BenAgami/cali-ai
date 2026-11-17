import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import {
  type FormFeedbackRequest,
  type FormFeedbackResult,
  LlmError,
  type LlmProvider,
  type WorkoutPlanRequest,
  type WorkoutPlanResult,
} from "./types";

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

const buildFormFeedbackOutputSchema = (allowedTags: string[]) =>
  z.object({
    summary: z.string(),
    positives: z.array(
      z.object({ text: z.string(), repNumbers: z.array(z.number().int()) }),
    ),
    corrections: z.array(
      z.object({
        errorTag:
          allowedTags.length > 0
            ? z.enum(allowedTags as [string, ...string[]])
            : z.string(),
        repNumbers: z.array(z.number().int()),
        cue: z.string(),
        detail: z.string(),
      }),
    ),
  });

const requireParsedOutput = <T>(message: {
  stop_reason: string | null;
  parsed_output: T | null;
}): T => {
  if (message.stop_reason === "refusal") {
    throw new LlmError("REFUSAL", "Model refused the request");
  }
  if (message.stop_reason === "max_tokens") {
    throw new LlmError("INVALID_OUTPUT", "Model output was truncated");
  }
  if (!message.parsed_output) {
    throw new LlmError("INVALID_OUTPUT", "Model returned no parsed output");
  }
  return message.parsed_output;
};

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

    const plan = requireParsedOutput(message);

    return {
      plan,
      model: message.model,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  }

  async generateFormFeedback(
    req: FormFeedbackRequest,
  ): Promise<FormFeedbackResult> {
    let message;
    try {
      message = await this.client.messages.parse(
        {
          model: req.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: "user", content: req.userPrompt }],
          output_config: {
            format: zodOutputFormat(
              buildFormFeedbackOutputSchema(req.allowedTags),
            ),
            effort: req.effort,
          },
        },
        { signal: req.signal, timeout: req.timeoutMs, maxRetries: 0 },
      );
    } catch (error) {
      throw mapAnthropicError(error);
    }

    const feedback = requireParsedOutput(message);

    return {
      feedback,
      model: message.model,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  }
}
