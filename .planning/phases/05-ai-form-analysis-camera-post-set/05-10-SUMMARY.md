---
phase: 05-ai-form-analysis-camera-post-set
plan: 10
subsystem: api
tags: [llm, anthropic, structured-output, prompt, validation]
requires: ["05-04", "05-06"]
provides:
  - LlmProvider.generateFormFeedback (Anthropic adapter, cancellable)
  - buildFormFeedbackPrompt / FORM_FEEDBACK_PROMPT_VERSION (form-feedback-v1)
  - feedbackService.generateFormFeedback + validateFormFeedback
  - typed TimeoutCode
affects: [05-16]
key-files:
  created:
    - apps/api/src/prompts/formFeedbackPrompt.ts
    - apps/api/tests/unit/prompts/formFeedbackPrompt.test.ts
    - apps/api/tests/unit/services/feedbackService.test.ts
    - apps/api/tests/unit/helpers/scoredMetrics.ts
  modified:
    - apps/api/src/lib/llm/types.ts
    - apps/api/src/lib/llm/anthropicProvider.ts
    - apps/api/src/lib/llm/index.ts
    - apps/api/src/services/feedbackService.ts
    - apps/api/src/utils/withTimeout.ts
    - apps/api/tests/unit/helpers/fakeLlmProvider.ts
    - apps/api/tests/unit/lib/llm/anthropicProvider.test.ts
    - apps/api/tests/unit/utils/withTimeout.test.ts
requirements-completed: [FORM-06, FORM-07, PROF-07]
completed: 2026-11-09
---

# Phase 5 Plan 10: Form feedback LLM call Summary

Structured-output form feedback via the Anthropic adapter, with a server-side validator (rep numbers, tags, banned/forbidden terms, length caps) and one repair attempt.

## Tasks

1. Provider `generateFormFeedback` with signal/timeout/maxRetries 0, tag-enum output schema, shared stop_reason handling - c9d4aa0
2. Versioned prompt (profile context and derived measurements only, no keypoints/scores) - 8c9b51a
3. `feedbackService.generateFormFeedback`, `validateFormFeedback`, `TimeoutCode` - f078c8d
4. Knip cleanup of unused type re-exports - ac663f9

## Deviations from Plan

- [Rule 3] `FormFeedbackRequest`/`FormFeedbackResult` are not re-exported from `lib/llm/index.ts`: Knip flagged them and `/** @public */` on export specifiers was not honoured. They remain importable from `lib/llm/types`.
- Added `tests/unit/helpers/scoredMetrics.ts` (shared ScoredFormMetrics fixture) so two test files can reuse it without a test file exporting.
- Test note: the SDK's zod helper renders a `z.enum` as a `description` string (`{enum: [...]}`) in the JSON schema, so the tag-enum test asserts on that.

## Notes

- Full unit suite currently has failures in `tests/unit/metrics/rubrics/*` (dip, pushUp), from another executor's in-progress rubric work; out of scope. Services/utils/lib/prompts suites pass (402 tests). tsc, eslint and Knip are clean for this plan's files.
- Old `generateFeedback` stub retained for 05-16.

## Self-Check: PASSED
