---
phase: 01-infrastructure
plan: 08
subsystem: api
tags: [bullmq, worker, reaper, redis, shutdown, retries]
requires: ["01-01", "01-02", "01-05", "01-06"]
provides:
  - processAnalysisJob / onAnalysisJobFailed (worker processors)
  - processReapJob and a BullMQ job scheduler (every 15 s)
  - startWorkers / stopWorkers wired into process start and graceful shutdown
  - feedbackService seam (Phase 5 replaces with the Claude call)
affects: [01-07, 01-09]
tech-stack:
  added: []
  patterns: [BullMQ-native retries + UnrecoverableError, job scheduler instead of cron, per-job logger.child]
key-files:
  created:
    - apps/api/src/workers/analysisProcessor.ts
    - apps/api/src/workers/reaperProcessor.ts
    - apps/api/src/workers/index.ts
    - apps/api/src/services/feedbackService.ts
    - apps/api/tests/unit/helpers/bullmqJob.ts
    - apps/api/tests/unit/workers/analysisProcessor.test.ts
    - apps/api/tests/unit/workers/reaperProcessor.test.ts
    - apps/api/tests/integration/workers/analysisWorker.test.ts
  modified:
    - apps/api/src/lib/queue.ts
    - apps/api/src/lib/shutdown.ts
    - apps/api/src/index.ts
    - apps/api/tests/unit/lib/shutdown.test.ts
key-decisions:
  - Workers run in the API process on dedicated Redis connections (separate entrypoint can be split out later)
  - Session becomes FAILED only in the worker "failed" handler on the final attempt; CAPTURE_MISSING/CAPTURE_INVALID are UnrecoverableError and fail at once
  - Retry defaults live on the queue (3 attempts, exponential backoff); reaper is a job scheduler on a maintenance queue
requirements-completed: []
duration: 35min
completed: 2026-10-22
---

# Phase 1 Plan 08: Worker, Reaper and Lifecycle Summary

A BullMQ worker (concurrency 5) processes capture jobs off the HTTP thread through QUEUED -> ANALYZING_REPS -> WRITING_FEEDBACK -> COMPLETED, with a timeout-bounded feedback seam, and a 15 s reaper scheduler fails runs stuck in PROCESSING.

## Tasks

1. Processor + feedback seam (TDD): `3813902` (RED), `3191bf8` (GREEN)
2. Reaper, queue config, worker lifecycle, shutdown wiring: `ab414a5`
3. Integration test against real Redis and Postgres: `c27a933`
4. Knip fix: `9675592`

## Behavior

- Every job logs through one `logger.child({ jobId, sessionId })`.
- LLM seam bounded by `withTimeout(..., env.analysis.llmTimeoutMs, "LLM_TIMEOUT")`; a timeout is retryable.
- Shutdown order: server, workers, progress bus, both queues, Redis, Prisma (asserted with `invocationCallOrder`).
- Integration cases: valid capture reaches COMPLETED; corrupt blob reaches FAILED/CAPTURE_INVALID with attemptsMade 1; stale job id is discarded; reaper scheduler registered with `every` = 15000.

## Deviations from Plan

**1. [Rule 3 - Blocking] Knip unused export**
- `FeedbackService` class export was flagged; made it module-private (default instance remains exported).

**2. [Rule 1 - Test] Fixed two timing assumptions in unit tests**
- LLM timeout test waits for the (real-thread-pool) gunzip before advancing fake timers; the "ignores second signal" shutdown test now waits for the queue close call since more awaits precede it.

## Notes

- INFRA-01, INFRA-02 and INFRA-04 left Pending: they also depend on 01-07 (capture endpoint), per orchestrator instruction.
- `yarn workspace api lint` currently reports 3 `no-unnecessary-type-assertion` errors in `tests/unit/services/captureService.test.ts`, which belongs to the parallel plan 01-07 and was not touched. Unit suite (395 tests), check-types, knip and format:check pass; the workers integration suite passes (4 tests).

## Known Stubs

- `apps/api/src/services/feedbackService.ts` `generateFeedback` returns a placeholder summary and the metrics in `analysisProcessor.ts` are a stub; both are intentional Phase 1 seams replaced in Phase 5. No AnalysisResult row is written.

## Self-Check: PASSED
