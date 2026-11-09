import type { FormDimension } from "@repo/common";

import { env } from "../config/env";
import { getLlmProvider, LlmError, type FormFeedbackDraft } from "../lib/llm";
import type { LlmEffort } from "../lib/llm/types";
import type { Logger } from "../lib/logger";
import type { FindingSeverity, ScoredFormMetrics } from "../metrics/types";
import {
  buildFormFeedbackPrompt,
  FORM_FEEDBACK_PROMPT_VERSION,
  type FormFeedbackContext,
} from "../prompts/formFeedbackPrompt";

const FORM_FEEDBACK_EFFORT: LlmEffort = "low";
const FORM_FEEDBACK_MAX_TOKENS = 1200;
const MAX_FORM_ATTEMPTS = 2;
const MIN_ATTEMPT_MS = 1000;
const MAX_POSITIVES = 3;
const GENERIC_FORM_ISSUE = "The previous response was not valid feedback";
const LENGTH_CAPS = { summary: 200, positive: 200, cue: 120, detail: 280 };

const BANNED_PATTERNS: RegExp[] = [
  /\d+\s*(°|deg\b|degrees?)/i,
  /\b(valgus|varus|injur(?:y|ies|ed|e)|diagnos\w*|medical|physio\w*|rehab\w*|bmi|body fat|overweight|underweight|kg|kilograms?|lbs?|pounds|centimet(?:er|re)s?)\b/i,
];

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type ValidatedCorrection = {
  tag: string;
  dimension: FormDimension;
  severity: FindingSeverity;
  title: string;
  cue: string;
  detail: string;
  repNumbers: number[];
};

export type ValidatedFormFeedback = {
  summary: string;
  positives: { text: string; repNumbers: number[] }[];
  corrections: ValidatedCorrection[];
};

export type FormFeedbackOutcome = {
  feedback: ValidatedFormFeedback;
  model: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number };
  attempts: number;
};

export type FormFeedbackValidation =
  | { ok: true; feedback: ValidatedFormFeedback }
  | { ok: false; issues: string[] };

const uniqueSorted = (values: number[]): number[] =>
  [...new Set(values)].sort((a, b) => a - b);

export const validateFormFeedback = (
  draft: FormFeedbackDraft,
  metrics: ScoredFormMetrics,
): FormFeedbackValidation => {
  const issues: string[] = [];
  const forbiddenPatterns = metrics.forbiddenTopics.map(
    (topic) => new RegExp(`\\b${escapeRegExp(topic)}\\b`, "i"),
  );

  const checkText = (label: string, text: string, maxLength?: number) => {
    if (maxLength !== undefined && text.length > maxLength) {
      issues.push(`The ${label} must be at most ${maxLength} characters`);
    }
    if (BANNED_PATTERNS.some((pattern) => pattern.test(text))) {
      issues.push(
        `The ${label} must not contain joint-angle numbers, medical or injury terms, or body measurements`,
      );
    }
    if (forbiddenPatterns.some((pattern) => pattern.test(text))) {
      issues.push(`The ${label} must not mention a forbidden topic`);
    }
  };

  const isRepInSet = (rep: number): boolean =>
    Number.isInteger(rep) && rep >= 1 && rep <= metrics.repCount;

  checkText("summary", draft.summary, LENGTH_CAPS.summary);

  if (draft.positives.length === 0) {
    issues.push("Include at least one positive observation");
  }
  const positives = draft.positives.slice(0, MAX_POSITIVES);
  for (const positive of positives) {
    checkText("positive", positive.text, LENGTH_CAPS.positive);
    if (!positive.repNumbers.every(isRepInSet)) {
      issues.push(
        `Positive rep numbers must be between 1 and ${metrics.repCount}`,
      );
    }
  }

  const expectedTags = metrics.corrections.map((c) => c.tag);
  const draftTags = draft.corrections.map((c) => c.errorTag);
  const isTagSetExact =
    draftTags.length === expectedTags.length &&
    expectedTags.every(
      (tag) => draftTags.filter((t) => t === tag).length === 1,
    );
  if (!isTagSetExact) {
    issues.push(
      `Provide exactly one correction for each of these tags: ${
        expectedTags.length > 0 ? expectedTags.join(", ") : "(none)"
      }`,
    );
  }

  for (const correction of draft.corrections) {
    const finding = metrics.corrections.find(
      (c) => c.tag === correction.errorTag,
    );
    checkText("cue", correction.cue, LENGTH_CAPS.cue);
    checkText("detail", correction.detail, LENGTH_CAPS.detail);
    if (
      finding &&
      !correction.repNumbers.every((rep) => finding.repNumbers.includes(rep))
    ) {
      issues.push(
        `Rep numbers for ${finding.tag} must be among: ${finding.repNumbers.join(", ")}`,
      );
    }
  }

  if (issues.length > 0) return { ok: false, issues: [...new Set(issues)] };

  const corrections: ValidatedCorrection[] = metrics.corrections.map(
    (finding) => {
      const match = draft.corrections.find((c) => c.errorTag === finding.tag);
      return {
        tag: finding.tag,
        dimension: finding.dimension,
        severity: finding.severity,
        title: finding.label,
        cue: match?.cue ?? finding.cue,
        detail: match?.detail ?? "",
        repNumbers: uniqueSorted(match?.repNumbers ?? []),
      };
    },
  );

  return {
    ok: true,
    feedback: {
      summary: draft.summary,
      positives: positives.map((p) => ({
        text: p.text,
        repNumbers: uniqueSorted(p.repNumbers),
      })),
      corrections,
    },
  };
};

class FeedbackService {
  /**
   * The LLM only phrases the server-selected findings; validateFormFeedback
   * enforces FORM-06/07 and D-14, with one repair attempt.
   */
  async generateFormFeedback(input: {
    metrics: ScoredFormMetrics;
    context: FormFeedbackContext;
    signal: AbortSignal;
    timeoutMs: number;
    log: Logger;
  }): Promise<FormFeedbackOutcome> {
    const { metrics, context, signal, log } = input;
    const deadline = Date.now() + input.timeoutMs;
    let previousIssues: string[] | undefined;

    for (let attempt = 1; attempt <= MAX_FORM_ATTEMPTS; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < MIN_ATTEMPT_MS) {
        throw new LlmError("TIMEOUT", "Form feedback deadline reached");
      }

      const { system, user } = buildFormFeedbackPrompt({
        metrics,
        context,
        previousIssues,
      });

      let result;
      try {
        result = await getLlmProvider().generateFormFeedback({
          model: env.llm.primaryModel,
          effort: FORM_FEEDBACK_EFFORT,
          maxTokens: FORM_FEEDBACK_MAX_TOKENS,
          timeoutMs: remaining,
          signal,
          system,
          userPrompt: user,
          allowedTags: metrics.corrections.map((c) => c.tag),
        });
      } catch (error) {
        if (
          error instanceof LlmError &&
          (error.code === "REFUSAL" || error.code === "INVALID_OUTPUT")
        ) {
          previousIssues = [GENERIC_FORM_ISSUE];
          continue;
        }
        throw error;
      }

      const validation = validateFormFeedback(result.feedback, metrics);
      if (validation.ok) {
        return {
          feedback: validation.feedback,
          model: result.model,
          promptVersion: FORM_FEEDBACK_PROMPT_VERSION,
          usage: result.usage,
          attempts: attempt,
        };
      }
      previousIssues = validation.issues;
      log.warn(
        { attempt, issues: validation.issues },
        "Form feedback failed validation",
      );
    }

    throw new LlmError(
      "INVALID_OUTPUT",
      "Form feedback failed validation after repair",
    );
  }
}

export default new FeedbackService();
