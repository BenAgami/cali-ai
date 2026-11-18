---
phase: 05-ai-form-analysis-camera-post-set
plan: 09
subsystem: api
tags: [metrics, rubrics, pose, vitest]
requires:
  - phase: 05-02
    provides: shared form-analysis constants (BLAZEPOSE, FormDimension)
  - phase: 05-06
    provides: geometry, preprocess, segmentReps, synthetic pose generator
provides:
  - ExerciseRubric contract and four exercise rubrics (rubric-v0)
  - getRubric(exerciseCode) registry and RUBRIC_VERSION
affects: [05-10, 05-14, 05-17]
tech-stack:
  added: []
  patterns: [pure per-exercise rubric modules driven generically by the orchestrator]
key-files:
  created:
    - apps/api/src/metrics/rubrics/types.ts
    - apps/api/src/metrics/rubrics/shared.ts
    - apps/api/src/metrics/rubrics/pushUp.ts
    - apps/api/src/metrics/rubrics/dip.ts
    - apps/api/src/metrics/rubrics/squat.ts
    - apps/api/src/metrics/rubrics/pullUp.ts
    - apps/api/src/metrics/rubrics/index.ts
    - apps/api/tests/unit/helpers/rubricRun.ts
    - apps/api/tests/unit/metrics/rubrics/pushUp.test.ts
    - apps/api/tests/unit/metrics/rubrics/dip.test.ts
    - apps/api/tests/unit/metrics/rubrics/squat.test.ts
    - apps/api/tests/unit/metrics/rubrics/pullUp.test.ts
  modified:
    - apps/api/tests/unit/helpers/syntheticPose.ts
key-decisions:
  - "Lockout / full-hang / stand extremes are measured over rep frames plus 0.5 s of surrounding rest, because segmentation cuts a rep where the signal re-crosses the rest threshold (about 70% of amplitude), so the true top lies just outside the rep window."
  - "Squat thigh length is taken from unmasked rawPoints so the low-visibility-knee fallback signal (-hipY / thigh) still has a scale."
requirements-completed: [FORM-05, FORM-06]
duration: 40min
completed: 2026-11-09
---

# Phase 5 Plan 09: Exercise Rubrics Summary

Four pure rubric modules (push_up, dip, squat, pull_up) transcribing the approved rubric-v0 tags, severities, labels, cues, ramps, weights, positives and forbidden topics, pinned by synthetic-skeleton round-trip tests.

## Tasks

1. Rubric contract, shared helpers, push-up and dip rubrics - 8bef283
2. Squat and pull-up rubrics, full registry - cc93396

## Parameter recovery pinned (synthetic generator)

Elbow/knee angles +/- 3 deg, trunk lean +/- 3 deg, hip offset +/- 0.02, hip sway +/- 0.03 (peak-to-peak = 2 x generator amplitude, dip and pull-up), elbow asymmetry +/- 3 deg, shoulder tilt +/- 3 deg, heel rise +/- 3 deg, near-knee fallback still yields 5 squat reps.

## Deviations from Plan

**1. [Rule 1 - Bug] Lockout extremes measured outside the segmented rep window**
- Issue: reps are cut at the 0.7-amplitude rest threshold, so maxElbowDeg / maxKneeDeg over `[startIndex, endIndex]` read about 149 deg for a 170 deg lockout and flagged every clean rep as an incomplete lockout.
- Fix: `lockoutFrames` (rep frames +/- 0.5 s) used for maxElbowDeg (push_up, dip, pull_up) and maxKneeDeg (squat).

**2. [Rule 3 - Blocking] Synthetic generator extended (05-06 helper)**
- Dip: shoulder anchored over the bars (the old geometry swung the shoulder 0.5 torso per rep, so DIP_SWING fired on clean reps); `hipSwayRatio` now applies to dip.
- Hip sway (dip, pull_up) is locked to rep phase so peak-to-peak is deterministic (2 x amplitude).
- `elbowAsymmetryDeg` is now the exact left/right elbow-angle gap (was about half).
- Heel rise scales with rep progress (a constant lift cancelled against the first-second baseline) and the near heel/foot are no longer masked as far-side in side view.
- Squat shin lean coefficient 0.35 -> 0.03, so an 85 deg knee puts the hip at knee height (previously hipBelowKnee was -0.49, contradicting the plan's expected values).

**3. Test values adjusted from the plan text (rubric thresholds unchanged)**
- Rushed tempo repSec: rep duration is about 0.63-0.7 x repSec, so push_up 1.2, squat 1.2, pull_up 1.6 (plan used 0.9 / 1.0, which segmentation drops as under 0.8 s).
- dip HIGH shallow uses depth 130 with lockout 175 (130/170 falls under the 40 deg amplitude gate).
- squat shallow MEDIUM uses depth 95; depth 120 gives HIGH (hip far above knee). The "minKneeDeg > 110" branch is pinned by a direct rule evaluation.
- pull_up HIGH asymmetry uses 25 deg: the per-rep mean gap runs about 3 deg under the peak, so 22 lands at 19.1 (MEDIUM, the rubric uses the mean).
- Test helper `tests/unit/helpers/rubricRun.ts` added (not in the plan's file list).

## Known Stubs

None.

## Verification

`yarn workspace api test:unit` (723 passed), check-types, lint, `yarn format:check` clean. `yarn knip` reports only four unused native files from other plans (recordingMessages, useRecordedSet, usePoseSource, recordedSetStore); nothing from this plan (`getRubric` / `RUBRIC_VERSION` tagged `/** @public */` for 05-14).

## Self-Check: PASSED
