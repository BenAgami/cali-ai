---
phase: 04-ai-workout-generation
plan: 05
subsystem: api
tags: [llm, anthropic, validation, vitest, prisma]

requires:
  - phase: 04-ai-workout-generation
    provides: AI gate (04-03), LLM provider and prompt builder (04-04)
provides:
  - validateGeneratedPlan pure validator (catalog, type and safety bounds)
  - workoutGenerationService.generate with three-attempt ladder, daily cap, in-flight guard and generation row bookkeeping
  - createFakeLlmProvider test helper
affects: [04-06 controller/route, 04-09 eval]

tech-stack:
  added: []
  patterns:
    - "Per-request logger.child with generationId/userId; goalText never logged"
    - "Single AbortController deadline shared across attempts instead of withTimeout"

key-files:
  created:
    - apps/api/src/utils/validateGeneratedPlan.ts
    - apps/api/src/services/workoutGenerationService.ts
    - apps/api/tests/unit/utils/validateGeneratedPlan.test.ts
    - apps/api/tests/unit/helpers/fakeLlmProvider.ts
    - apps/api/tests/unit/services/workoutGenerationService.test.ts
  modified: []

key-decisions:
  - "Validator re-checks all numeric ranges server-side (sets 1-6, reps 1-30, hold 5-120 s, rest 30-300 s; beginner sets <=4, reps <=15) because the API ignores min/max in structured output"
  - "TIMEOUT advances the ladder without feedback; REFUSAL/INVALID_OUTPUT send a generic feedback line; an aborted deadline stops the ladder with GENERATION_FAILED"

patterns-established:
  - "Failed generations count toward the rolling 24 h cap (no status filter)"

requirements-completed: [WKT-05, WKT-06, WKT-07]

duration: 20min
completed: 2026-11-04
---

# Phase 4 Plan 05: Generation Core Summary

**Pure plan validator plus `workoutGenerationService.generate` running the Haiku, Haiku-with-feedback, Sonnet ladder with daily cap, in-flight guard and a provenance row per request.**

## Accomplishments

- `validateGeneratedPlan` collects every issue (unknown codes, 3-6 exercises, reps-vs-duration by exercise type, level-based bounds), hydrates valid plans and truncates name/note.
- `generate` runs the AI gate, rolling 24 h cap (429 `DAILY_LIMIT_REACHED`), PENDING guard (409 `GENERATION_IN_PROGRESS`), catalog check, then the attempt ladder. Rate limit/outage map to 503 `LLM_RATE_LIMITED`/`LLM_UNAVAILABLE`; exhaustion to 503 `GENERATION_FAILED`; unexpected errors mark the row `INTERNAL` and rethrow.
- 35 new unit tests (18 validator, 17 service); full unit suite passes (497) and `check-types` is clean.

## Task Commits

1. Task 1: validator - `f6745da`
2. Task 2: service, fake provider, tests - `aa28985`

## Deviations from Plan

None - plan executed as written.

## Known Issues

- `yarn knip` reports the service default export (and 04-04's `LlmErrorCode` type export) as unused until the controller from plan 04-06 imports them. Expected; not fixed here.

## Known Stubs

None.

## Self-Check: PASSED
