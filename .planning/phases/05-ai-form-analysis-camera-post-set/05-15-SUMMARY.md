---
phase: 05-ai-form-analysis-camera-post-set
plan: 15
subsystem: native-recording-ui
tags: [recording, camera, workout-execute, ai-prerequisites]
requires: [05-12, 05-13]
provides:
  - useAiPrerequisiteSteps / AiPrerequisiteSteps shared by Generate with AI and the recording screen
  - /record-set route, FramingGuide overlay
  - Record this set offer and in-workout analysing rows in workout-execute
affects: [05-18]
tech-stack:
  added: []
  patterns: [screen split into guard + Recorder so hooks stay unconditional, JSX-only screen over useRecordedSet]
key-files:
  created:
    - apps/native/src/hooks/useAiPrerequisiteSteps.ts
    - apps/native/src/components/AiPrerequisiteSteps.tsx
    - apps/native/src/components/form/FramingGuide.tsx
    - apps/native/app/(main)/record-set.tsx
  modified:
    - apps/native/src/hooks/useWorkoutGenerate.ts
    - apps/native/app/(main)/workout-generate.tsx
    - apps/native/src/hooks/useWorkoutExecution.ts
    - apps/native/app/(main)/workout-execute.tsx
    - apps/native/app/(main)/_layout.tsx
    - apps/native/src/hooks/useRecordedSet.ts
key-decisions:
  - "Recording screen reads prerequisites from useAiPrerequisiteSteps and the phase from useRecordedSet; both share the profile query cache, so no explicit refetch is needed when steps complete"
  - "startedAtMs is lazy useState, not a ref read during render"
requirements-completed: [FORM-01, FORM-02, FORM-03, FORM-08, PROF-07]
completed: 2026-11-09
---

# Phase 5 Plan 15: Recording Flow UI Summary

Per-set "Record this set" offer, a full-screen `/record-set` route driven by `useRecordedSet` with the vision-camera preview wired to the MediaPipe pose source, shared inline AI prerequisites, and live analysing rows inside the workout run.

## Tasks

| Task | Commit |
| ---- | ------ |
| 1. Extract shared AI prerequisite steps | ee01022 |
| 2. FramingGuide and record-set screen | f6cc998 |
| 3. Record offer and analysing rows in workout-execute | 6110cd3 |

## Notes

- Camera gets `pixelFormat="rgb"`, `frameProcessor`, and `cameraHandlers.onLayout` / `onOutputOrientationChanged` (`onDeviceChange` is already fed inside `useRecordedSet`).
- FramingGuide layer sets `direction: "ltr"`. The guide uses a centred outline, so no per-dot mirroring applies.
- Returning from a submitted recording calls `completeSet()` via `consumeRecordedSetDone` in a focus effect.
- Native verification (check-types, lint, prettier, knip) passes. Nothing was exercised on a device; that is 05-18 UAT.

## Deviations from Plan

1. **[Rule 3] Knip cleanup.** Un-exported `COUNTDOWN_SECS`, `AUTO_STOP_SEC`, `RECORDING_TARGET_FPS` (useRecordedSet.ts, no importers) and removed the now-unused `GenerateStep` alias (useWorkoutGenerate.ts). The four previously unused native files are now used.
2. **No skeleton dots overlay.** The plan's screen has no dot overlay and screens may not hold state, so `latestFrameRef` and the `1 - dot.x` front-camera flip are not used here. If an overlay is added later it must flip x for the front camera and use `direction: "ltr"`.
3. **No explicit `refetchPrerequisites` call** on READY; the prerequisite mutations invalidate the shared profile query, which `useRecordedSet` reads.
4. The first task commit initially carried a Claude co-author trailer by mistake; it was amended away immediately, and no commit on the branch carries one.

## Known Stubs

None.

## Self-Check: PASSED
