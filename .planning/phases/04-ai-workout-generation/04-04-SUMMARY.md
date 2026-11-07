---
phase: 04-ai-workout-generation
plan: 04
subsystem: api
tags: [anthropic, llm, structured-outputs, prompt, zod]
requires:
  - phase: 04-01
    provides: env.llm config
provides:
  - LlmProvider interface, LlmError with five normalized codes
  - AnthropicProvider (messages.parse + zodOutputFormat) and getLlmProvider() lazy singleton
  - buildWorkoutPlanPrompt and WORKOUT_PLAN_PROMPT_VERSION
affects: [04-05, 04-09]
tech-stack:
  added: ["@anthropic-ai/sdk@1.4.0"]
  patterns: [constructor-injected SDK client for tests, per-request z.enum of catalog codes]
key-files:
  created:
    - apps/api/src/lib/llm/types.ts
    - apps/api/src/lib/llm/anthropicProvider.ts
    - apps/api/src/lib/llm/index.ts
    - apps/api/src/prompts/workoutPlanPrompt.ts
    - apps/api/tests/unit/lib/llm/anthropicProvider.test.ts
    - apps/api/tests/unit/prompts/workoutPlanPrompt.test.ts
  modified: [apps/api/package.json, yarn.lock]
key-decisions:
  - "SDK retries disabled (maxRetries 0); cancellation via signal + per-call timeout, withTimeout not used"
  - "stop_reason checked before parsed_output; refusal -> REFUSAL, max_tokens -> INVALID_OUTPUT"
requirements-completed: [WKT-05, WKT-07]
duration: 20min
completed: 2026-11-04
---

# Phase 4 Plan 04: LLM Provider Seam and Prompt Summary

Anthropic structured-output adapter behind a small LlmProvider interface with five normalized error codes, plus a pure versioned prompt builder carrying level, goal, height, weight and the live catalog.

## Accomplishments
- AnthropicProvider calls `messages.parse` with `zodOutputFormat` over a per-request `z.enum` of exercise codes, `{ signal, timeout, maxRetries: 0 }`.
- Error mapping: RateLimitError -> RATE_LIMITED; connection timeout / user abort / AbortError -> TIMEOUT; other APIError -> UNAVAILABLE; anything else -> INVALID_OUTPUT. Original error kept as `cause`.
- Prompt keeps goal text only in the user turn inside `<goal>` tags; retry feedback block on `previousIssues`.
- 13 provider tests + 6 prompt tests; full unit suite (462) passes, check-types, lint and deps:lint clean.

## SDK typing findings (open question 2)
Installed SDK 1.4.0 typings matched the plan: `output_config.effort` accepts `'low'|'medium'|'high'|'xhigh'|'max'`, `zodOutputFormat` lives at `@anthropic-ai/sdk/helpers/zod`, error classes are exposed on the `Anthropic` namespace. No differences; effort is sent as planned.

## Task Commits
1. Provider seam: c0e1ef6
2. Prompt builder: e61d615

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
A transient `.git/index.lock` from a concurrent executor; commit was retried.

## Next Phase Readiness
Plan 04-05 can call `getLlmProvider()` and `buildWorkoutPlanPrompt`; it must re-validate numeric ranges server-side. ANTHROPIC_API_KEY needed in apps/api/.env for real calls.

## Self-Check: PASSED
