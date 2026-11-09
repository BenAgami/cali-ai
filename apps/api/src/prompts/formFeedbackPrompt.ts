import {
  FORM_BAND_LABELS,
  FORM_DIMENSION_LABELS,
  FORM_DIMENSIONS,
  type ExperienceLevel,
} from "@repo/common";

import type { ScoredFormMetrics } from "../metrics/types";

export const FORM_FEEDBACK_PROMPT_VERSION = "form-feedback-v1";

export type FormFeedbackContext = {
  exerciseDisplayName: string;
  experienceLevel: ExperienceLevel;
  heightCm: number;
  weightKg: number;
};

export type FormFeedbackPromptInput = {
  metrics: ScoredFormMetrics;
  context: FormFeedbackContext;
  previousIssues?: string[];
};

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const buildSystemPrompt = (forbiddenTopics: string[]): string => {
  const forbidden =
    forbiddenTopics.length > 0 ? forbiddenTopics.join(", ") : "none";
  return [
    "You are a calisthenics coach writing post-set feedback for one athlete.",
    "Write in the second person. Be encouraging and concise.",
    "Lead with at least one positive, drawn only from the supplied positive candidates.",
    "Write exactly one correction per supplied finding, using its errorTag. Keep the meaning of the supplied cue (you may rephrase it, but add no new advice). Give one actionable cue per correction.",
    'Refer to reps using only the rep numbers supplied for that item (1-based, for example "rep 3").',
    "Do not use joint-angle numbers or degrees, and avoid anatomical jargon.",
    "Make no medical, injury or pain claims: no medical language of any kind.",
    "Do not mention height, weight or body composition; they are context only.",
    "Do not mention the band or any score.",
    `Never mention these topics: ${forbidden}.`,
    "Adapt your vocabulary to the experience level (BEGINNER: plain words) but never soften or change a correction.",
    "The summary is one sentence.",
  ].join("\n");
};

const buildUserPrompt = (input: FormFeedbackPromptInput): string => {
  const { metrics, context, previousIssues } = input;

  const payload = {
    exercise: {
      code: metrics.exerciseCode,
      displayName: context.exerciseDisplayName,
    },
    cameraView: metrics.cameraView,
    experienceLevel: context.experienceLevel,
    heightCm: context.heightCm,
    weightKg: context.weightKg,
    repCount: metrics.repCount,
    reps: metrics.reps.map((rep) => ({
      repNumber: rep.repNumber,
      durationSec: round(rep.durationSec, 1),
      features: Object.fromEntries(
        Object.entries(rep.features).map(([name, value]) => [
          name,
          round(value, 2),
        ]),
      ),
      tags: rep.tags.map((t) => t.tag),
    })),
    dimensions: FORM_DIMENSIONS.map((dimension) => {
      const assessed = metrics.dimensions[dimension];
      return {
        dimension: FORM_DIMENSION_LABELS[dimension],
        assessment:
          assessed.isAssessed && assessed.band
            ? FORM_BAND_LABELS[assessed.band]
            : "not assessed",
      };
    }),
    corrections: metrics.corrections.map((c) => ({
      errorTag: c.tag,
      label: c.label,
      cue: c.cue,
      severity: c.severity,
      repNumbers: c.repNumbers,
    })),
    positiveCandidates: metrics.positives.map((p) => ({
      text: p.text,
      repNumbers: p.repNumbers,
    })),
  };

  const sections = [JSON.stringify(payload, null, 2)];
  if (previousIssues && previousIssues.length > 0) {
    sections.push(
      [
        "Your previous answer had these problems; fix all of them:",
        ...previousIssues.map((issue) => `- ${issue}`),
      ].join("\n"),
    );
  }
  return sections.join("\n\n");
};

export const buildFormFeedbackPrompt = (
  input: FormFeedbackPromptInput,
): { system: string; user: string } => ({
  system: buildSystemPrompt(input.metrics.forbiddenTopics),
  user: buildUserPrompt(input),
});
