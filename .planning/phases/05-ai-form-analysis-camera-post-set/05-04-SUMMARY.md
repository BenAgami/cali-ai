---
phase: 05-ai-form-analysis-camera-post-set
plan: 04
subsystem: common-contracts
tags: [zod, shared-contracts, consent, pose-capture]
requires: []
provides:
  - "Shared Phase 5 contracts in @repo/common (formAnalysis.ts)"
  - "quantizeCapture + optional capture aspectRatio"
  - "AI_CONSENT_VERSION 2026-11-08 with new notice text"
affects: [05-api-metrics, 05-api-read-endpoints, 05-native]
tech-stack:
  added: []
  patterns: ["ES5-safe helpers in @repo/common (no includes/find/Set; package has no lib target)"]
key-files:
  created:
    - packages/common/src/validations/formAnalysis.ts
    - apps/api/tests/unit/common/formAnalysis.test.ts
    - apps/api/tests/unit/common/poseCapture.test.ts
  modified:
    - packages/common/src/validations/analysis.ts
    - packages/common/src/validations/workoutSession.ts
    - packages/common/src/validations/poseCapture.ts
    - packages/common/src/validations/aiPrerequisites.ts
    - packages/common/src/index.ts
    - apps/native/src/constants/aiMessages.ts
    - apps/api/tests/unit/services/userService.test.ts
key-decisions:
  - "SESSION_STATUSES moved to analysis.ts to avoid an import cycle"
  - "No formScore in any shared shape; bands only"
requirements-completed: [FORM-01, FORM-03, FORM-04, FORM-05, FORM-09, PROF-07]
duration: 25min
completed: 2026-11-08
---

# Phase 5 Plan 04: Shared form analysis contracts Summary

Every cross-app Phase 5 contract (exercises, capture setup, BlazePose joints, bands, untrackable advice, result and recorded-set shapes, capture quantization, consent bump) now lives once in `@repo/common`.

## Tasks
1. Task 1 (a57e7c3): `formAnalysis.ts`, `SESSION_STATUSES` moved to `analysis.ts`, `workoutId`/`setNumber` on session create/response schemas, session list item and paginated list schemas, unit tests.
2. Task 2 (4a0da79): optional `aspectRatio`, `quantizeCapture`, consent version `2026-11-08`, new notice text, worst-case gzip test (2700 frames x 33 keypoints is under the 1 MiB cap).

## Deviations from Plan

**1. [Rule 3 - Blocking] ES5 lib in @repo/common** - the package has no `lib` target, so `includes`, `Array.find` and `Set` failed type-checking. Rewrote with `indexOf`, a loop and `filter`. Commit a57e7c3 (amended content before commit).

**2. [Rule 3 - Blocking] Consent version in existing test** - `userService.test.ts` hardcoded `"2026-11-04"`, which no longer type-checks against the literal. Updated to `2026-11-08`. Commit 4a0da79.

**3. Test fix** - the quantize test initially set a non-monotonic timestamp which the payload schema rejected; adjusted the test data.

## Verification
`@repo/common` build and check-types, `api` check-types, `native` check-types and the full API unit suite (528 tests) pass. Knip not run (deferred to 05-18 per plan).

## Known Stubs
None.

## Self-Check: PASSED
