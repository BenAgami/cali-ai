---
phase: 05-ai-form-analysis-camera-post-set
plan: 11
subsystem: api
tags: [express, prisma, zod, openapi, rate-limit, consent]
requires:
  - phase: 05-02
    provides: AnalysisResult/AnalysisFinding schema
  - phase: 05-04
    provides: shared form analysis contracts in @repo/common
  - phase: 05-07
    provides: aiPrerequisitesService and session creation gate
provides:
  - Consent (428) and cap (429) gating on capture; consent gating on retry
  - GET /api/sessions/:id/analysis (band, chips, positives, corrections or untrackable advice)
  - GET /api/workouts/:id/recorded-sets
  - storedScoreBreakdownSchema / storedRawFeedbackSchema JSON column contract (for the 05-16 writer)
affects: [05-12, 05-15, 05-16]
tech-stack:
  added: []
  patterns: [response built then re-parsed with the shared Zod schema so formScore can never leak]
key-files:
  created:
    - apps/api/src/services/analysisResultQueryService.ts
    - apps/api/src/utils/storedAnalysis.ts
    - apps/api/tests/unit/services/analysisResultQueryService.test.ts
    - apps/api/tests/integration/sessions/getSessionAnalysis.test.ts
    - apps/api/tests/integration/workouts/listRecordedSets.test.ts
  modified:
    - apps/api/src/services/captureService.ts
    - apps/api/src/config/env.ts
    - apps/api/.env.example
    - apps/api/src/controllers/session.ts
    - apps/api/src/controllers/workout.ts
    - apps/api/src/routes/session.ts
    - apps/api/src/routes/workout.ts
    - apps/api/src/openapi/schemas.ts
    - apps/api/src/openapi/paths/sessions.ts
    - apps/api/src/openapi/paths/workouts.ts
    - apps/api/tests/unit/helpers/unitEnv.ts
    - apps/api/tests/unit/config/env.test.ts
    - apps/api/tests/unit/services/captureService.test.ts
    - apps/api/tests/integration/sessions/captureSession.test.ts
    - apps/api/tests/integration/helpers/requestSender/sessionsRequests.ts
    - apps/api/tests/integration/helpers/requestSender/workoutsRequests.ts
key-decisions:
  - "Check order at capture: ownership 404, status 409, consent/prerequisites 428, daily cap 429, per-exercise-per-workout cap 429"
  - "Caps count PoseCapture rows; retries reuse the stored capture row so they count toward neither cap"
  - "Per-exercise cap reads workoutId/exerciseId with its own workoutSession lookup in captureService rather than widening the shared analysisStateService snapshot"
requirements-completed: [FORM-03, FORM-04, FORM-05, FORM-08, FORM-09, PROF-07]
duration: ~1h
completed: 2026-11-09
---

# Phase 5 Plan 11: Capture gating and analysis read endpoints Summary

Captures now require current AI consent and respect a 15/24h daily cap and a 2-per-exercise-per-workout cap, and the app can read a set's result and a workout's recorded sets through shared shapes that never carry `formScore`.

## Tasks

| Task | Commit | Notes |
| ---- | ------ | ----- |
| 1. Consent gate and caps at capture | 4dbb64a | `FORM_ANALYSIS_DAILY_CAP` (15), `FORM_ANALYSIS_EXERCISE_WORKOUT_CAP` (2), 428/429 OpenAPI |
| 2. GET /api/sessions/:id/analysis | d488674 | 409 `ANALYSIS_NOT_READY`, 404 for other users |
| 3. GET /api/workouts/:id/recorded-sets | 61d4b37 | up to 50, `performedAt` desc then `id` desc |

## Verification actually run

- Unit: `captureService`, `env`, `analysisResultQueryService` suites pass (49 + 8 tests). Full `test:unit`: 717 passed, 5 failed; the failures are all in `tests/unit/metrics/rubrics/{squat,pullUp}.test.ts`, untracked in-progress work from another parallel plan (05-09), not touched by this plan.
- `yarn workspace api check-types`: clean. `yarn workspace api lint`: clean. Prettier clean for all files of this plan (`format:check` only flags the 4 rubric files from 05-09).
- Knip: no findings for this plan's files; it reports 4 unused native files (`recordingMessages.ts`, `useRecordedSet.ts`, `usePoseSource.ts`, `recordedSetStore.ts`) belonging to other in-flight plans.
- **Integration tests were NOT run.** Docker is not running and Postgres on `localhost:5433` is unreachable (`P1001: Can't reach database server at localhost:5433` from `globalSetup`). The three new/updated integration suites (`captureSession`, `getSessionAnalysis`, `listRecordedSets`) are written and type-checked/linted but unexecuted; they must be run once the test DB is up.

## Deviations from Plan

None in behaviour. Minor additions: `.env.example` documents the two new env vars; `env.test.ts` asserts their defaults; request-sender helpers `getSessionAnalysis` and `getRecordedSets` were added to the integration helpers.

Note on the environment: `python3` on this machine is a non-functional Windows stub, so an initial round of scripted edits silently did nothing and was redone with `python`. No effect on the committed result.

## Known Stubs

None. `storedAnalysis.ts` schemas are consumed by the query service now; 05-16 will write rows to match them.

## Self-Check: PASSED
