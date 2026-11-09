---
phase: 05-ai-form-analysis-camera-post-set
plan: 05
subsystem: testing
tags: [pose, blazepose, fixtures, vitest, python]
requires:
  - phase: 05-04
    provides: poseCapturePayloadSchema, FORM_KEY_JOINTS
provides:
  - 16 real BlazePose skeleton fixtures with ground-truth rep counts
  - loadPoseFixture / listPoseFixtures test helpers
affects: [05-06, 05-09, 05-14, 05-17]
tech-stack:
  added: []
  patterns: [skeleton-only gzip fixtures validated through the shared payload schema]
key-files:
  created:
    - scripts/pose-eval/dump_keypoints.py
    - apps/api/tests/unit/metrics/fixtures/manifest.json
    - apps/api/tests/unit/metrics/fixtures/*.json.gz
    - apps/api/tests/unit/helpers/poseFixtures.ts
    - apps/api/tests/unit/metrics/fixtures.test.ts
  modified:
    - scripts/pose-eval/README.md
key-decisions:
  - "Fixture timestamps are index/15 (clean 15 fps grid) rather than source ms"
requirements-completed: [FORM-05, FORM-09]
duration: resumed after interruptions
completed: 2026-11-09
---

# Phase 5 Plan 05: Pose Fixtures Summary

16 skeleton-only BlazePose fixtures (15 fps, quantized, gzip, 8-29 KB each) exported from the Phase 1 clips, with a manifest of exercise/view/light/expectedReps and a TypeScript loader that validates through `poseCapturePayloadSchema`.

## Tasks

1. Keypoint dump script and fixtures - 73715b2
2. Fixture loader and sanity test - c6da2de (29 tests pass, no DB/network)

## Deviations from Plan

None. The pre-commit hook/linter removed a non-null assertion from fixtures.test.ts; tsc and tests still pass.

## Issues Encountered

`yarn workspace api lint` exits 0 but reports one warning in `tests/unit/metrics/segmentReps.test.ts` (05-06's file, out of scope). `yarn knip` reports unused exports in `apps/api/src/metrics/*` (other in-flight plans), not from this plan.

## Known Stubs

None.

## Self-Check: PASSED
