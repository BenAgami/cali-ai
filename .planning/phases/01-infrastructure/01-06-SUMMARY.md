---
phase: 01-infrastructure
plan: 06
subsystem: api
tags: [zod, gzip, capture, timeout, keypoints]
requires:
  - phase: 01-02
    provides: analysis validations in @repo/common
provides:
  - poseCapturePayloadSchema, CAPTURE_LIMITS, PoseCapturePayload (@repo/common)
  - encodeCapture, decodeCapture, KEYPOINTS_FORMAT, InvalidCaptureError
  - withTimeout, TimeoutError
affects: [01-07, 01-08]
tech-stack:
  added: []
  patterns: [single-pass superRefine validation, coded timeout errors]
key-files:
  created:
    - packages/common/src/validations/poseCapture.ts
    - apps/api/src/utils/captureCodec.ts
    - apps/api/src/utils/withTimeout.ts
    - apps/api/tests/unit/utils/captureCodec.test.ts
    - apps/api/tests/unit/utils/withTimeout.test.ts
  modified:
    - packages/common/src/index.ts
key-decisions:
  - "Storage format gzip-json-v1: whole validated payload re-gzipped server-side"
  - "decodeCapture joins zod issue messages with '; ' into the InvalidCaptureError message"
requirements-completed: []
duration: 15min
completed: 2026-10-22
---

# Phase 1 Plan 06: Capture Contract and Utilities Summary

Keypoint capture payload schema (D-04 caps, version literal) in @repo/common, a gzip-json-v1 storage codec with a distinct InvalidCaptureError, and a hard-timeout wrapper with coded TimeoutError.

## Tasks
1. Capture schema + codec: tests `206ce46`, impl `243270b`
2. withTimeout: tests `5704a91`, impl `4632930`

## Deviations from Plan
None in behavior. The plan's `getZodErrorMessage` returns an array of `{message}`, so the codec joins messages into a string for the error. The codec test was reformatted with Prettier in the task 2 commit.

## Notes
- Requirements INFRA-01/INFRA-02 not marked complete: they depend on plans 01-07/01-08.
- Verification: unit suite 365 passing, lint, check-types and format:check green. One intermediate unit run failed because of the parallel agent's in-progress analysisStateService files, and it passed on rerun.

## Known Stubs
None.

## Self-Check: PASSED
