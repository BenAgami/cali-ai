import Anthropic from "@anthropic-ai/sdk";

import { env } from "../../config/env";
import { AnthropicProvider } from "./anthropicProvider";
import { LlmError, type LlmProvider } from "./types";

let provider: LlmProvider | undefined;

export const getLlmProvider = (): LlmProvider => {
  if (provider) return provider;
  if (!env.llm.apiKey) {
    throw new LlmError("UNAVAILABLE", "ANTHROPIC_API_KEY is not configured");
  }
  provider = new AnthropicProvider(
    new Anthropic({ apiKey: env.llm.apiKey, maxRetries: 0 }),
  );
  return provider;
};

export { LlmError } from "./types";
export type { LlmProvider, WorkoutPlanDraft, WorkoutPlanResult } from "./types";
