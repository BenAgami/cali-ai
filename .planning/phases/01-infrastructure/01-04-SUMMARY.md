---
phase: 01-infrastructure
plan: 04
subsystem: pose-eval
tags: [pose-model, blazepose, movenet, evaluation]
requires: []
provides:
  - Pose-model decision for criterion 6 (D-21): BlazePose Full, 33 keypoints
  - Offline evaluator in scripts/pose-eval with committed result tables
key-files:
  created:
    - .planning/phases/01-infrastructure/01-POSE-MODEL-DECISION.md
    - scripts/pose-eval/results/summary.csv
    - scripts/pose-eval/results/summary.md
  modified:
    - scripts/pose-eval/README.md
    - .planning/PROJECT.md
    - docs/architecture.md
key-decisions:
  - BlazePose Full wins (4/4); MoveNet Lightning and Thunder pass only squat (1/4)
  - Push-up and dip scored on the near side only (side-on camera required)
requirements-completed: [INFRA-05]
completed: 2026-11-08
---

# Phase 1 Plan 04: Pose-model gate Summary

All 16 shot-list clips were evaluated (pull-up reshot on Nov 3) and BlazePose Full passes all four exercises. Details and numbers: `01-POSE-MODEL-DECISION.md`.

## Resolution for state tooling

The STATE.md "Open decisions" entry for the pose model (MoveNet vs 33-point) is resolved: BlazePose Full.

## Risks carried to Phase 5

- No official fast-tflite recipe for BlazePose; two-stage pipeline on device.
- Provisional: one person; squat hold l_knee is weak (0.463 confidence); pull-up has no dim-light take.
- Payload moves to 33 keypoints; capture schema already allows 17-33, size caps to be rechecked.
