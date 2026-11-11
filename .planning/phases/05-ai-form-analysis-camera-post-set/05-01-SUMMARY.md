---
phase: 05-ai-form-analysis-camera-post-set
plan: 01
subsystem: native-pose
tags: [blazepose, mediapipe, vision-camera, spike, android]
requires: []
provides:
  - PoseFrame / PoseSource contract (apps/native/src/pose/types.ts)
  - useMediaPipePose adapter (option B runtime)
  - 05-POSE-RUNTIME-DECISION.md (Wave 0 gate: PASS)
affects: [05-13, 05-15]
tech-stack:
  added: [react-native-mediapipe-posedetection@0.4.0, expo-screen-orientation]
  patterns: [plugin-owned frame processor, per-camera rotation to upright]
key-files:
  created:
    - apps/native/src/pose/types.ts
    - apps/native/src/pose/useMediaPipePose.ts
    - apps/native/app/(main)/dev-blazepose-check.tsx
    - .planning/phases/05-ai-form-analysis-camera-post-set/05-POSE-RUNTIME-DECISION.md
  modified:
    - apps/native/package.json
    - apps/native/app.json
    - apps/native/app/(main)/(tabs)/settings.tsx
    - yarn.lock
key-decisions:
  - "Pose runtime is MediaPipe PoseLandmarker via react-native-mediapipe-posedetection 0.4.0 (GPU); option A not needed"
  - "Android plugin returns raw landscape sensor-frame landmarks; adapter rotates per camera in portrait"
  - "Use targetFps 60 (about 30 fps); 15 quantises to about 12 fps"
requirements-completed: [FORM-02]
duration: multi-session
completed: 2026-11-09
---

# Phase 5 Plan 01: BlazePose runtime spike Summary

BlazePose Full runs on a Galaxy S25+ at about 30 fps (GPU) through the MediaPipe plugin, passing the C1-C3 gate, with an adapter that rotates Android's raw landscape landmarks to an upright, unmirrored `PoseFrame`.

## Tasks

| Task | Commit |
| ---- | ------ |
| 1. Plugin, contract, adapter, spike screen, EAS build | c777e36 |
| 2. Device spike (checkpoint, run by developer) | n/a |
| 2b. Adapter fixes found on device: portrait rotation, overlay | 5a44468 |
| 3. Decision doc | docs commit for this plan |

## Results

C1 PASS (about 30 fps GPU), C2 PASS (94%), C3 PASS (100%), C4 marginal (88%), C5 and C6 not run (user injury), C7 PASS, C8 PASS after rotation, C9 PASS. Full table and traps in `05-POSE-RUNTIME-DECISION.md`.

## Deviations from Plan

1. **[Rule 3 - Blocking] No `createRunOnJS` in the adapter.** The plugin owns the frame processor and delivers results to JS itself, so the Task 1 acceptance grep for `createRunOnJS` intentionally does not match.
2. **[Rule 1 - Bug] `IS_FRONT_OUTPUT_MIRRORED` removed.** Device testing showed Android frames are not mirrored; the real defect was orientation, fixed by `toUpright` plus an `isPortrait` option (commit 5a44468). Task 3's constant update is moot.
3. **Extra hook outputs:** `delegate`, `lastError`, `cameraHandlers`; `UsePoseSourceOptions` gained `isPortrait`.

## Deferred Issues / Risks

- C4 squat 88% (marginal), C5 pull-up and C6 dim light unverified.
- 180-degree landscape orientation not handled (for 05-13).
- iOS runtime untested.
- 831 MB EAS archive; an `.easignore` would help.

## Known Stubs

None.

## Self-Check: PASSED
