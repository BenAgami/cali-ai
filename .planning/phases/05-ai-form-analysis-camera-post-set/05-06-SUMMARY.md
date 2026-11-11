---
phase: 05-ai-form-analysis-camera-post-set
plan: 06
subsystem: api
tags: [metrics, pose, geometry, rep-segmentation, trackability, vitest]
requires:
  - phase: 05-02
    provides: approved rubric thresholds (05-RUBRICS.md)
  - phase: 05-04
    provides: shared pose/form contracts in @repo/common
provides:
  - metrics-v1 type contract (FormMetrics etc.)
  - 2D geometry helpers and ramp scoring primitive
  - toPoseSeries preprocessing (isotropic, mask, gap fill, smoothing, near side)
  - segmentReps hysteresis rep counter
  - checkTrackability FORM-09 preflight and MIN_REPS_FOR_BAND
  - buildSyntheticCapture test skeleton generator
affects: [05-09, 05-10, 05-14, 05-16]
tech-stack:
  added: []
  patterns: [pure versioned metrics engine, synthetic kinematic skeletons for tests]
key-files:
  created:
    - apps/api/src/metrics/types.ts
    - apps/api/src/metrics/geometry.ts
    - apps/api/src/metrics/preprocess.ts
    - apps/api/src/metrics/segmentReps.ts
    - apps/api/src/metrics/trackability.ts
    - apps/api/tests/unit/helpers/syntheticPose.ts
    - apps/api/tests/unit/metrics/geometry.test.ts
    - apps/api/tests/unit/metrics/preprocess.test.ts
    - apps/api/tests/unit/metrics/segmentReps.test.ts
    - apps/api/tests/unit/metrics/trackability.test.ts
  modified: []
key-decisions:
  - "KEY_JOINTS_HIDDEN uses the fraction of frames where all key joints are visible; OUT_OF_FRAME counts x and y coordinates separately"
  - "Synthetic dropoutFrames drops every landmark to visibility 0.1"
requirements-completed: [FORM-05, FORM-06, FORM-09]
duration: ~25min
completed: 2026-11-09
---

# Phase 5 Plan 06: Metrics Foundation Summary

Pure metrics foundation: isotropic geometry, gap-filled and smoothed pose series, hysteresis rep segmentation and the FORM-09 trackability gate, with a parametric synthetic skeleton generator for all four exercises.

## Tasks

| Task | Commit |
| ---- | ------ |
| 1. Types, geometry, preprocessing | 4d73fb9 |
| 2. Synthetic generator and segmentReps | e73091f |
| 3. Trackability preflight | c12250a |

## Verification

`yarn workspace api test:unit tests/unit/metrics` passes (37 tests from this plan; fixtures.test.ts from 05-05 also present and passing), eslint and prettier clean, no tsc errors in the new files, Knip reports nothing for `apps/api/src/metrics`.

## Deviations from Plan

- **[Rule 3 - Blocking]** Knip flagged `METRICS_VERSION` and `FormMetrics` as unused exports; tagged `/** @public */` since 05-14/05-16 consume them.
- Thresholds in the plan matched 05-RUBRICS sections 3 and 9; no edited values.
- Synthetic data only; 05-05 fixtures were not needed.

## Deferred / Out of scope

- `yarn workspace api check-types` reports errors in unrelated existing tests (e.g. `tests/unit/services/workoutSessionService.test.ts`), not touched here.
- Knip reports two unused native hooks (`useRecordedSets.ts`, `useSessionAnalysis.ts`) belonging to other plans.
- The synthetic generator pins only the push-up round trip; 05-09 must pin the squat, dip and pull-up parameter recovery (hipOffset, trunkLean, asymmetry, tilt, heelRise, sway).

## Known Stubs

None.

## Self-Check: PASSED
