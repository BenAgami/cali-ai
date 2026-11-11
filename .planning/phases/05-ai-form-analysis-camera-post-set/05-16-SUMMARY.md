---
phase: 05-ai-form-analysis-camera-post-set
plan: 16
subsystem: api
tags: [bullmq, worker, llm, abortcontroller, prisma, form-analysis]
requires:
  - phase: 05-03
    provides: AnalysisResult/AnalysisFinding schema
  - phase: 05-10
    provides: generateFormFeedback and LlmError codes
  - phase: 05-11
    provides: stored JSON schemas and read endpoints
  - phase: 05-14
    provides: computeFormMetrics
provides:
  - Real analysis worker pipeline (metrics -> LLM -> guarded persist -> complete)
  - FormAnalysisResultService (saveScored / saveUntrackable)
  - analysisStateService.getAnalysisJobContext
affects: [05-17, native result screens]
tech-stack:
  added: []
  patterns:
    - "Run-guarded $transaction (status PROCESSING + bullmqJobId) around upsert/deleteMany/createMany"
    - "Real AbortController deadline passed to the LLM call instead of withTimeout"
key-files:
  created:
    - apps/api/src/services/formAnalysisResultService.ts
    - apps/api/tests/unit/services/formAnalysisResultService.test.ts
    - apps/api/tests/integration/sessions/analysisResultFlow.test.ts
  modified:
    - apps/api/src/workers/analysisProcessor.ts
    - apps/api/src/services/analysisStateService.ts
    - apps/api/src/services/feedbackService.ts
    - apps/api/src/utils/withTimeout.ts
    - apps/api/tests/unit/workers/analysisProcessor.test.ts
    - apps/api/tests/unit/services/analysisStateService.test.ts
    - apps/api/tests/unit/utils/withTimeout.test.ts
    - apps/api/tests/unit/helpers/prismaMock.ts
    - apps/api/tests/integration/workers/analysisWorker.test.ts
key-decisions:
  - "LlmError INVALID_OUTPUT/REFUSAL become UnrecoverableError(ANALYSIS_ERROR) because the in-attempt repair already ran; TIMEOUT/RATE_LIMITED/UNAVAILABLE are rethrown so BullMQ retries"
  - "Final LlmError TIMEOUT maps to failure reason LLM_TIMEOUT in toFailureReason"
  - "TimeoutCode narrowed to ENQUEUE_TIMEOUT (resolves the STATE.md withTimeout concern)"
metrics:
  tasks: 3
  completed: 2026-11-09
---

# Phase 5 Plan 16: Worker pipeline Summary

The analysis worker now runs the real pipeline: decode the capture, compute form metrics, short-circuit untrackable sets with no LLM call, call the LLM under a real AbortController deadline, persist the result in a run-guarded transaction, then complete the run.

## Tasks

| Task | Commit | Notes |
| ---- | ------ | ----- |
| 1. Guarded result persistence + job context | c87736e | unit tests pass |
| 2. Rewrite processor, remove stubs | fdddeca | unit tests pass |
| 3. Integration tests | 08e6c06 | written, type-checked, linted; NOT RUN |

## Verification actually performed

- `yarn workspace api test:unit`: 64 files, 790 tests passed.
- `yarn workspace api check-types`, `yarn workspace api lint`, `yarn format:check`, `yarn knip`: clean.
- **Integration tests were NOT run.** Docker/Postgres (:5433) was not running (docker daemon unreachable) and Redis was therefore not available either. `analysisWorker.test.ts` and `analysisResultFlow.test.ts` compile and lint but have never executed; their behavioural claims (synthetic push-up scores, 1-rep capture is UNTRACKABLE with NO_REPS_DETECTED, retry yields one result) are unverified. Run `yarn workspace api test:integration` with Docker up before treating Task 3 as proven.

## Deviations from Plan

**1. [Rule 3 - Blocking] prismaMock gained models**
- `analysisResult`, `analysisFinding` delegates and an `upsert` method added to `tests/unit/helpers/prismaMock.ts` (not in the plan's file list) so the new service can be unit tested.

**2. [Scope] No separate transient-LLM-outage integration test**
- Omitted a retry-on-UNAVAILABLE integration test (backoff timing unknown without running); the unrecoverable/retryable mapping is covered by unit tests instead.

**3. Planning docs**
- The STATE.md `withTimeout` concern (line ~134) is now resolved in code but was not edited by hand, per the instruction to touch STATE.md only through gsd-tools. It should be removed in a follow-up.

## Known Stubs

None.

## Self-Check: PASSED (files and commits exist; integration tests unexecuted as stated above)
