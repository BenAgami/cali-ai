---
phase: 05-ai-form-analysis-camera-post-set
plan: 13
subsystem: native-recording-engine
tags: [pose, recording, state-machine, form-setup]
requires: [05-01, 05-02, 05-04, 05-06, 05-08]
provides:
  - evaluateSetup / buildPoseCapturePayload / SETUP_ISSUES in @repo/common
  - usePoseSource seam, useRecordedSet state machine, recording copy, recordedSetStore
affects: [05-15]
tech-stack:
  added: []
  patterns: [frame callback touches refs only, JS-interval setup evaluation, derived phase over stage state]
key-files:
  created:
    - packages/common/src/validations/formSetup.ts
    - apps/api/tests/unit/common/formSetup.test.ts
    - apps/native/src/pose/usePoseSource.ts
    - apps/native/src/constants/recordingMessages.ts
    - apps/native/src/state/recordedSetStore.ts
    - apps/native/src/hooks/useRecordedSet.ts
  modified:
    - packages/common/src/index.ts
    - apps/native/src/pose/useMediaPipePose.ts
key-decisions:
  - "Frames are thinned to 15 fps in the consumer (pose source runs at targetFps 60, ~30 fps) so 175 s fits under the 3600-frame cap"
  - "Opposite-direction landscape is handled in the adapter with a 180 degree turn keyed off the camera's reported output orientation"
  - "No luma: the plugin owns the frame processor, so lumaMean is always null and TOO_DARK never fires live"
requirements-completed: [FORM-02, FORM-03]
duration: ~40 min
completed: 2026-11-09
---

# Phase 5 Plan 13: Recording Engine Summary

Pure setup gating and payload building in `@repo/common` (20 unit tests), plus the `useRecordedSet` hook driving prerequisites, permission, setup, countdown, recording, upload and retry for a single screen to render.

## Tasks

| Task | Commit |
| ---- | ------ |
| 1. formSetup.ts + tests | 74e4071, lint fix 8e6755e |
| 2. Pose seam, messages, store, useRecordedSet | f8e99a0 |

## Behaviour notes

- `useRecordedSet` also returns `cameraHandlers` (must be wired to the `Camera`), `latestFrameRef` (for overlays), `isLoadingPrerequisites` and `isUploadRetryable` (false for 429 limit errors). `uploadError` is the user-facing message string.
- Pose runs only in setup/countdown/recording. The setup check runs every 250 ms and treats a stream with no frames for 1 s as not detected. Start needs 1 s of continuous readiness; the countdown pauses while not ready.
- 428 on upload refetches the profile and returns to setup (prerequisites derive from the profile). 429 maps to DAILY_LIMIT / EXERCISE_LIMIT.
- Landscape 180 degree case: back camera matches `landscape-left`, front `landscape-right`; any other landscape direction flips `(1-x, 1-y)`. The vision-camera orientation naming and this mapping are inferred from the decision doc's sensor naming and are NOT verified on device; check in 05-18 UAT.
- Screen 05-15 still needs: front-camera overlay dots as `1 - x`, `direction: "ltr"` on overlay layers, wiring `cameraHandlers`.

## Deviations from Plan

1. **[Rule 3] Keep-awake via `activateKeepAwakeAsync`/`deactivateKeepAwake`** instead of `useKeepAwake`, because the hook cannot be called conditionally by phase. The acceptance grep for the literal `useKeepAwake` therefore does not match.
2. **No luma callback / `onLuma` option**: the decision doc records luma as unavailable, so the plan's "if unsupported, never call it" branch applies; types.ts unchanged.
3. **[Rule 1] Lint fixes** in formSetup.ts (`Math.hypot` and `Array.at` are not resolved by common's lib target); separate commit 8e6755e.
4. Test fixtures use `scale: 1` (push-up) and `scale: 0.5` (pull-up): the synthetic pull-up skeleton clips the bottom edge at larger scales.
5. No `deviceModel` (expo-device not installed); `appVersion` from expo-constants.

## Known Stubs

None.

## Issues

- `yarn knip` reports 4 unused files (`useRecordedSet.ts`, `usePoseSource.ts`, `recordingMessages.ts`, `recordedSetStore.ts`) until plan 05-15 imports them. This is by plan design; no `@public` tag exists for files. One pre-existing unused export (`getRecordedSets` in integration helpers) belongs to another plan.
- Nothing here was exercised on a device; the hook has no automated tests (native app has no runner).

## Self-Check: PASSED
