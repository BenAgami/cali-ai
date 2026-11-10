---
phase: 05-ai-form-analysis-camera-post-set
plan: 17
subsystem: api
tags: [form-analysis, rubric, calibration, pose-fixtures]
requires:
  - phase: 05-14
    provides: computeFormMetrics and the 16 pose fixtures
provides:
  - calibrate:form script and 05-CALIBRATION.md (Run 1 rubric-v0, Run 2 rubric-v1)
  - rubric-v1 (squat ROM ramp tightened)
  - upright push-up and dip fixtures
affects: [phase-05 verification]
tech-stack:
  added: []
  patterns: ["calibration report generated from fixtures, user verdicts recorded beside it"]
key-files:
  created:
    - apps/api/scripts/form-calibration/run.ts
    - .planning/phases/05-ai-form-analysis-camera-post-set/05-CALIBRATION.md
  modified:
    - apps/api/package.json
    - apps/api/src/metrics/rubrics/index.ts
    - apps/api/src/metrics/rubrics/squat.ts
    - apps/api/tests/unit/metrics/computeFormMetrics.test.ts
    - apps/api/tests/unit/metrics/rubrics/squat.test.ts
    - apps/api/tests/unit/metrics/rubrics/pushUp.test.ts
    - apps/api/tests/unit/metrics/fixtures/ (push_up and dip *.json.gz, manifest.json)
    - scripts/pose-eval/evaluate.py
    - scripts/pose-eval/dump_keypoints.py
    - .planning/phases/05-ai-form-analysis-camera-post-set/05-RUBRICS.md
key-decisions:
  - "Fixed the fixture dump (video rotation tag) rather than the dip lean maths"
  - "Squat leniency fixed by tightening the ROM ramp, flag thresholds untouched"
  - "dip/diag45_1 segmentation left unfixed and pinned as NO_REPS_DETECTED"
requirements-completed: [FORM-04, FORM-05, FORM-07]
duration: n/a
completed: 2026-11-10
---

# Phase 5 Plan 17: Rubric calibration Summary

Calibration script plus a two-run report; user verdicts were applied, one real fixture defect (upside-down landscape clips) fixed, and the squat depth ramp tightened for rubric-v1.

## Commits

- 7e690c5 calibration script and Run 1 report
- 3ce7be8 apply video rotation tag in pose dump, re-dump fixtures, fix manifest label
- cfd9974 squat ROM ramp, RUBRIC_VERSION rubric-v1, 05-RUBRICS.md
- 3afe0b7 user verdicts and Run 2

## Before / after

| Clip | Reps before -> after | Score / band before -> after | Corrections before -> after |
|---|---|---|---|
| push_up/side_1 | 5 -> 5 | 98 EXC -> 99 EXC | none |
| push_up/side_2 | 5 -> 5 | 97 EXC -> 98 EXC | none |
| push_up/diag45_1 | untrackable WRONG_VIEW (intentional, D-17) | same | n/a |
| pull_up/back_1, front_1 | 5 -> 5 | 64 / 72 FAIR (unchanged) | asym + rushed (unchanged) |
| pull_up/side_1 | untrackable WRONG_VIEW (by design) | same | n/a |
| dip/side_1 | 5 -> 5 | 53 NEEDS_WORK -> 76 GOOD | LEAN + LOCKOUT -> LOCKOUT |
| dip/side_2 | 5 -> 5 | 55 NEEDS_WORK -> 77 GOOD | LEAN + LOCKOUT -> LOCKOUT |
| dip/diag45_1 | 3 -> untrackable (NO_REPS_DETECTED); user counted 5 | 55 NEEDS_WORK -> none | n/a |
| squat/diag45_1 | 5 -> 5 | 81 GOOD -> 73 FAIR | SHALLOW HIGH (unchanged) |
| squat/side_1 | 5 -> 5 | 90 EXC -> 80 GOOD | SHALLOW MEDIUM (unchanged) |
| squat/side_2 | 5 -> 5 | 87 GOOD -> 76 GOOD | SHALLOW MEDIUM (unchanged) |

## Investigations

1. Dip trunkLeanDeg was an artefact: landscape phone clips carry a 180 degree rotation tag that OpenCV did not apply, so push-up and dip fixtures were dumped upside-down. Fixed in `scripts/pose-eval/evaluate.py`; push-up and dip fixtures re-dumped (portrait fixtures byte-identical). Real lean is 37-38 deg, under the 45 deg flag.
2. Dip max elbow (146-152 deg) is real: elbow and wrist visibility 0.94-1.00.
3. dip/diag45_1: the 5 reps exist (about 90-140 deg) but the mount and dismount stretch the p5-p95 amplitude to about 117 deg so the hysteresis thresholds miss them. Not a small general fix; left, pinned in the golden test with a comment that the user counted 5.
4. Squat ROM ramp hipBelowKnee 0.0..-0.30 -> 0.0..-0.15. Proposed but not applied: a generic rule that Excellent requires no MEDIUM/HIGH ROM correction.
5. Manifest label: `pull_up/hold_front` was "side" because `clip_view` only matched stems starting with "front"; now matches by substring and reads "front".
6. WRONG_VIEW advice for pull_up/side_1 checked: it appends the pull-up hint (face or face away, portrait, whole body and bar visible), which is sensible. No WRONG_VIEW misfire on a side-on clip.

## Deviations from Plan

**1. [Rule 1 - Bug] Fixture dump ignored video rotation** - found while investigating dip lean; fixed in the pose-eval scripts and fixtures re-dumped (3ce7be8). The plan said to skip re-dumping for bad takes only; this was a separate defect.

**2. [Rule 1 - Bug] Manifest view label** - see investigation 5.

## Open items

- dip diag45 segmentation (active-window amplitude) is deferred.
- The generic "no Excellent with a MEDIUM/HIGH ROM correction" rule is not applied.
- Run 1 in 05-CALIBRATION.md reflects the upside-down fixtures (noted in the file).

## Known Stubs

None.

## Self-Check: PASSED
