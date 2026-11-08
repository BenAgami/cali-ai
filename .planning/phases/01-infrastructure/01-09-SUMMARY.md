---
phase: 01-infrastructure
plan: 09
subsystem: api
tags: [sse, redis-pubsub, streaming, progress]
requires: ["01-02", "01-05", "01-07"]
provides:
  - GET /api/sessions/:id/status Server-Sent Events endpoint (Bearer auth)
  - openSseStream helper (headers, flush, 15 s heartbeat, idempotent close)
  - analysisStreamService (assertStreamable, attach)
  - integration SSE reader (tests/integration/helpers/sseClient.ts)
affects: [01-10]
tech-stack:
  added: []
  patterns: [subscribe-then-read snapshot ordering, monotonic percent filter on the wire, single documented post-flush catch in the service]
key-files:
  created:
    - apps/api/src/lib/sse.ts
    - apps/api/src/services/analysisStreamService.ts
    - apps/api/tests/unit/lib/sse.test.ts
    - apps/api/tests/unit/services/analysisStreamService.test.ts
    - apps/api/tests/unit/controllers/session.test.ts
    - apps/api/tests/integration/helpers/sseClient.ts
    - apps/api/tests/integration/sessions/analysisStatusStream.test.ts
  modified:
    - apps/api/src/controllers/session.ts
    - apps/api/src/routes/session.ts
    - apps/api/src/openapi/schemas.ts
    - apps/api/src/openapi/paths/sessions.ts
    - apps/api/tests/integration/helpers/requestSender/sessionsRequests.ts
key-decisions:
  - Stream orchestration lives in analysisStreamService; the controller only wires assertStreamable, openSseStream and attach, with no try/catch
  - 404/409 are thrown before headers are flushed so the normal error handler answers; failures after flush are logged and close the stream
  - AnalysisStatusEvent is registered in OpenAPI without a named export (knip) and referenced from the path description
requirements-completed: []
duration: 30min
completed: 2026-10-22
---

# Phase 1 Plan 09: SSE Status Stream Summary

`GET /api/sessions/:id/status` streams `status` events (current Postgres state first, then live Redis pub/sub transitions), keeps percent monotonic, closes on COMPLETED or FAILED, and heartbeats every 15 s.

## Tasks

| Task | Commits |
| ---- | ------- |
| 1. SSE helper + analysisStreamService | 35560ed (RED), 9bb7b2e |
| 2. Controller, route, OpenAPI | 2d4e6a7 (RED), eff334a |
| 3. Real-HTTP integration test | 58aa484 |

## Verification

- `yarn workspace api test`: 63 files, 552 tests pass (unit suite also passes without Docker).
- Integration test proves: 200 + `text/event-stream`; QUEUED -> PROCESSING -> PROCESSING -> COMPLETED with stream close; reconnect gets current stage; terminal sessions get one event then end; 401, 404 (other user), 409 (PENDING).
- Root `lint`, `check-types`, `format:check`, `knip`, `deps:lint` all green.

## Deviations from Plan

**1. [Rule 3 - Blocking] Added `getAnalysisStatus` supertest helper** to `sessionsRequests.ts` for the 401/404/409 cases (file not in the plan's list; follows the existing helper pattern).

**2. [Rule 3 - Knip] `AnalysisStatusEvent` OpenAPI registration is not exported**, because an exported-but-unused binding fails `yarn knip`; the schema is still registered into components.

Otherwise the plan was executed as written.

## Known Stubs

None.

## Self-Check: PASSED
