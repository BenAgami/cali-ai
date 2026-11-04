---
phase: 04-ai-workout-generation
plan: 06
subsystem: api
tags: [express, prisma, openapi, vitest, llm]
requires:
  - phase: 04-05
    provides: workoutGenerationService.generate
provides:
  - POST /api/workouts/generate (synchronous preview)
  - createWorkout saves aiModel/generationId provenance
affects: [04-09, 04-11]
key-files:
  created:
    - apps/api/tests/integration/workouts/generateWorkout.test.ts
  modified:
    - apps/api/src/services/workoutService.ts
    - apps/api/src/controllers/workout.ts
    - apps/api/src/routes/workout.ts
    - apps/api/src/openapi/schemas.ts
    - apps/api/src/openapi/paths/workouts.ts
    - apps/api/tests/unit/services/workoutService.test.ts
    - apps/api/tests/integration/workouts/createWorkout.test.ts
    - apps/api/tests/integration/helpers/requestSender/workoutsRequests.ts
key-decisions:
  - "Foreign, failed or model-less generations all surface as 404; double save is 409 GENERATION_ALREADY_SAVED via P2002"
  - "updateWorkout leaves aiModel/generationId untouched so edited AI workouts stay flagged"
duration: 20min
completed: 2026-11-04
---

# Phase 4 Plan 06: Generate endpoint and save-with-provenance Summary

`POST /api/workouts/generate` returns a synchronous AI preview, and `POST /api/workouts` can save it with `generationId`, storing `aiModel` and the generation link.

## Tasks

1. Provenance in `createWorkout` (6802d8d): owned SUCCEEDED generation lookup, 404 otherwise, P2002 mapped to ConflictError. Unit tests added.
2. Controller, route (registered before `/:id`) and OpenAPI docs (f7c68dd).
3. Integration tests (6f30da5): only the LLM provider is stubbed; real Postgres, gate and service. Covers success, GENERATION_FAILED, the three 428 codes, daily cap 429, 400/401, and save/duplicate/foreign-user cases.

## Deviations from Plan

None. The first `check-types`/`lint` run failed once while other executors were editing the tree; it passed on re-run with no changes from me.

## Verification

Unit workoutService (36 tests) pass, integration workouts (9 files, 49 tests) pass, `check-types`, `lint` and `prettier --check` clean for `apps/api`.

## Known Stubs

None.

## Self-Check: PASSED
