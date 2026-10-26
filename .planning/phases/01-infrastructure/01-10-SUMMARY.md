---
phase: 01-infrastructure
plan: 10
subsystem: native
tags: [sse, react-native-sse, gzip, fflate, dev-screen]
requires: ["01-03", "01-07", "01-08", "01-09"]
provides:
  - workoutSessionResponseSchema and CaptureAccepted type in @repo/common
  - sessionsApi (create, submitCapture, retryAnalysis) and apiClient.postGzipJson
  - useAnalysisStatus SSE hook (Bearer header via react-native-sse)
  - usePipelineCheck hook and dev-only Pipeline check screen
affects: []
tech-stack:
  added: [react-native-sse, fflate]
  patterns: [shared response schema reused by the OpenAPI registry, manual state for streaming data]
key-files:
  created:
    - apps/native/src/api/endpoints/sessions.ts
    - apps/native/src/hooks/useAnalysisStatus.ts
    - apps/native/src/hooks/usePipelineCheck.ts
    - apps/native/app/(main)/dev-pipeline-check.tsx
  modified:
    - packages/common/src/validations/workoutSession.ts
    - packages/common/src/validations/poseCapture.ts
    - apps/api/src/openapi/schemas.ts
    - apps/native/src/api/client.ts
    - apps/native/src/constants/routes.ts
    - apps/native/app/(main)/_layout.tsx
    - apps/native/app/(main)/(tabs)/settings.tsx
key-decisions:
  - react-native-sse chosen as the SSE client (XHR-based, sends the Bearer header)
  - Phone uploads capture as Content-Type application/gzip (see deviation 1)
requirements-completed: []
duration: multi-session
completed: 2026-10-26
---

# Phase 1 Plan 10: Native Pipeline Check Summary

The phone can create a session, upload a gzipped synthetic keypoint capture, watch live SSE status (stage label and percent) with a Bearer header, and trigger retry, using response shapes shared with the OpenAPI registry.

## Tasks

| Task | Commits |
| ---- | ------- |
| 1. Shared response shapes and native sessions API (gzip upload) | 294e5f9 |
| 2. useAnalysisStatus, usePipelineCheck, dev Pipeline check screen | a4a9d26 |
| 3. Device verification (human-verify checkpoint) | approved, no commit |

Follow-up commits after the checkpoint: db19dcf (capture wire contract fix), 676d1fa (.env.example Redis note). The 01-04 blocker commit 780ffd3 also landed in this window and is unrelated to this plan.

## Device verification (Task 3)

Reported by the user: the pipeline check on the Android dev build reached COMPLETED, and all checks passed. The user did not list the individual stages, percentages, the queue-down message or the reconnect behaviour, so none of those are recorded here.

## Deviations from Plan

**1. [Rule 1 - Bug] Capture upload wire contract changed from Content-Encoding to application/gzip.** The first device run failed with HTTP 400. A temporary server log showed the phone's `Content-Encoding: gzip` header never arrived (only `Content-Type: application/json`, `Content-Length: 417`, `User-Agent: okhttp/4.12.0`), so `express.json()` tried to parse raw gzip bytes. The root cause of the header loss is not established. Fix in db19dcf:
- The phone sends the gzip bytes as `Content-Type: application/gzip`.
- The capture route uses `express.raw()` plus the new `gunzipCaptureBody` middleware, with a 10 MiB decompressed cap (`CAPTURE_LIMITS.maxInflatedBytes`).
- Plain JSON is still accepted.
- `rejectOversizedBody` now drains the body before answering 413.
- D-01 is amended in 01-CONTEXT.md.

This changes the 01-07 / 01-10 wire contract: the 01-07 SUMMARY still describes the earlier `Content-Encoding: gzip` contract.

**2. [Note] react-native-sse is XHR-based, not fetch-based as D-05 says.** It still sends the Bearer Authorization header, which is D-05's intent.

**3. [Rule 3 - Lint] Removed the planned `as unknown as BodyInit` cast** on the Uint8Array body because lint flagged it as unnecessary.

**4. [Rule 3 - Blocking] Integration tests need their own Redis database.** A running dev server shares Redis with the integration tests and its worker consumes the tests' jobs. `apps/api/.env.test` (gitignored, local) now uses `redis://localhost:6379/1`, and `.env.example` documents it (676d1fa).

## Known Stubs

None. The synthetic capture in usePipelineCheck is intentional dev-screen input; the real camera flow is Phase 5.

## Self-Check: PASSED
