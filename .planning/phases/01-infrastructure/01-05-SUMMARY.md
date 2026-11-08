---
phase: 01-infrastructure
plan: 05
subsystem: api
tags: [state-machine, prisma, bullmq, redis, reaper]
requires: ["01-01", "01-02"]
provides:
  - analysisStateService: single owner of processingStatus/analysisStage writes
  - ANALYSIS_FAILURE_REASONS / AnalysisFailureReason in @repo/common
affects: [01-06, 01-07, 01-08, 01-09]
tech-stack:
  added: []
  patterns: [guarded updateMany with expected prior state, fire-and-forget event publish after commit]
key-files:
  created:
    - apps/api/src/services/analysisStateService.ts
    - apps/api/tests/unit/services/analysisStateService.test.ts
    - apps/api/tests/integration/sessionAnalysis/analysisState.test.ts
  modified:
    - packages/common/src/validations/analysis.ts
    - apps/api/tests/unit/helpers/prismaMock.ts
key-decisions:
  - Session becomes PROCESSING at capture accept (QUEUED is a persisted stage), so the reaper clock also covers a stalled queue
  - Status events are published fire-and-forget so a down Redis never hangs capture requests or worker transitions
requirements-completed: []
duration: 25min
completed: 2026-10-22
---

# Phase 1 Plan 05: Analysis State Machine Summary

One `analysisStateService` owns every `processingStatus`/`analysisStage` write through guarded `updateMany` calls, with real-Postgres proof of the double-submit race, late-write discard and the stuck-run reaper.

## Tasks

1. Service with unit tests (TDD): `8fe1713` (RED), `bd55bbf` (GREEN)
2. Real-DB integration tests (10 cases): `726c4a9`, lint fix `af2855f`

## Behavior

- `startRunWithCapture`: guarded PENDING -> PROCESSING update first inside one transaction, then capture insert. A concurrent second submit gets count 0 and a 409 (verified with `Promise.allSettled`).
- `advanceStage` / `completeRun` / `failRun`: guarded on PROCESSING plus the run's `bullmqJobId`; stale or late writes return false. Stage progress never goes backwards; FAILED keeps the last stage.
- `restartRun`: FAILED -> PROCESSING only when a capture with keypoints is stored.
- `reapStuck`: fails PROCESSING runs older than `env.analysis.stuckTimeoutMs` with reason TIMEOUT.

## Deviations from Plan

None - plan executed as written. One small addition: `publishSnapshot` takes an optional predicate so `reapStuck` only publishes for sessions actually moved to FAILED.

## Issues / Notes

- `yarn knip` reports `analysisStateService` default export as unused (consumers arrive in 01-07/08/09, as the plan anticipated) and two unused exports in `apps/api/src/lib/queue.ts` (`FORM_ANALYSIS_QUEUE_NAME`, `ANALYSIS_JOB_NAME`), which belong to another plan and are not addressed here.
- INFRA-04 left Pending: the worker and reaper scheduling arrive in 01-08.
- `packages/common/src/index.ts` was modified by the parallel plan 01-06 and was not staged by this plan.

## Self-Check: PASSED
