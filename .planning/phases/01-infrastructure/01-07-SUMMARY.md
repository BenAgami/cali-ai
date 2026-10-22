---
phase: 01-infrastructure
plan: 07
subsystem: api
tags: [express, bullmq, gzip, openapi, capture, retry]
requires:
  - phase: 01-05
    provides: analysisStateService
  - phase: 01-06
    provides: capture schema, codec, withTimeout
provides:
  - POST /api/sessions/:id/capture (202 + job id)
  - POST /api/sessions/:id/analysis/retry
  - captureService, rejectOversizedBody, PayloadTooLargeError
  - captureAcceptedResponseSchema in @repo/common
affects: [01-08, 01-09, 01-10]
tech-stack:
  added: []
  patterns: [bounded enqueue with state rollback, declared-length compressed size cap]
key-files:
  created:
    - apps/api/src/services/captureService.ts
    - apps/api/src/controllers/session.ts
    - apps/api/src/routes/session.ts
    - apps/api/src/middlewares/rejectOversizedBody.ts
    - apps/api/src/errors/PayloadTooLargeError.ts
    - apps/api/src/openapi/paths/sessions.ts
    - apps/api/tests/unit/services/captureService.test.ts
    - apps/api/tests/unit/middlewares/rejectOversizedBody.test.ts
    - apps/api/tests/integration/sessions/captureSession.test.ts
    - apps/api/tests/integration/sessions/retryAnalysis.test.ts
  modified:
    - packages/common/src/validations/poseCapture.ts
    - apps/api/src/routes/index.ts
    - apps/api/src/errors/index.ts
    - apps/api/src/openapi/schemas.ts
    - apps/api/src/openapi/spec.ts
key-decisions:
  - "Retry is POST /api/sessions/:id/analysis/retry, no body, FAILED only, reuses stored capture, issues a new job id"
  - "Enqueue bounded to 5 s; failure fails the run with ENQUEUE_FAILED and returns 503"
requirements-completed: []
duration: 30min
completed: 2026-10-22
---

# Phase 1 Plan 07: Capture and Retry Endpoints Summary

Async capture over HTTP: gzipped keypoints are stored, the session moves to PROCESSING/QUEUED and a `form-analysis` job is enqueued, returning 202 with a job id in well under 500 ms, plus a retry endpoint that re-queues FAILED sessions from the stored capture.

## Tasks

1. captureService (TDD): RED `8a4a31b`, GREEN `8843e06`, lint fix `ab9fc1c`
2. HTTP layer (413 middleware, controller, `/sessions` router, OpenAPI): `008147e`
3. Integration tests against real Postgres and Redis: `9885a5b`, type fix `2934b43`

## Verification

- Unit suite 395 passing; `sessions/` integration 25 passing (capture 10, retry 5, plus existing workout-session suites matched by the filter).
- `yarn workspace api lint` and `check-types` green; root `format:check` and `yarn knip` green.
- 202 asserted `< 500` ms; gzip and plain bodies both accepted; 400/401/404/409/413 paths covered.

## Deviations from Plan

**1. [Rule 3 - Blocking] Fake-timer test stalled** - the enqueue timer is registered after the real async zlib encode, so advancing fake timers immediately did nothing. Test now waits (`vi.waitFor`) for `queue.add` to be called, then advances 5000 ms.

**2. [Rule 3 - Blocking] superagent corrupted the gzip body** - it JSON-stringifies Buffer bodies under a JSON content type. The request helper uses a pass-through `.serialize` (cast to satisfy its string-returning type).

Controllers use a plain `Request` with `Number(req.params.id)` (the plan's allowed fallback).

## Notes

- INFRA-02 requires the worker (01-08) for full delivery; INFRA-01, INFRA-02 and INFRA-04 left Pending for the orchestrator.
- ROADMAP/STATE counters were advanced via gsd-tools while 01-08 ran in parallel; the orchestrator should reconcile plan counts.
- OpenAPI listing at `/api/openapi.json` was not fetched manually; paths are registered in `spec.ts`.

## Known Stubs

None.

## Self-Check: PASSED
