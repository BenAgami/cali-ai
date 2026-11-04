---
phase: 04-ai-workout-generation
plan: 10
subsystem: native
tags: [expo, workout-builder, ai-disclaimer]
requires:
  - phase: 04-08
    provides: Generate screen, AiDisclaimer component
provides:
  - Edit-in-builder hand-off that preserves generationId
  - AI disclaimer on Start for saved AI workouts
affects: [04-11]
tech-stack:
  added: []
  patterns: [one-shot module store hand-off (mirrors pickedExerciseStore)]
key-files:
  created: [apps/native/src/state/generatedPlanStore.ts]
  modified:
    - apps/native/src/hooks/useWorkoutBuilder.ts
    - apps/native/src/hooks/useWorkoutGenerate.ts
    - apps/native/app/(main)/workout-builder.tsx
    - apps/native/app/(main)/workout-generate.tsx
    - apps/native/app/(main)/workout-detail.tsx
key-decisions:
  - "generationId is sent only on create, never on edit of an existing workout"
requirements-completed: [WKT-05]
duration: 10min
completed: 2026-11-04
---

# Phase 4 Plan 10: Edit in Builder and Start Disclaimer Summary

The preview can be opened in the existing workout builder via a one-shot store, and it stays flagged AI-generated on save because `generationId` rides along in the create payload. Saved AI workouts show the AI disclaimer above Start.

## Tasks

1. Edit-in-builder hand-off: commit 75806b7
2. AI disclaimer on Start: commit fcab8a0

## Deviations from Plan

None. Small addition: a wrapper view with horizontal padding around the compact disclaimer in the builder, since the component has no margin of its own.

## Verification

`yarn workspace native check-types` and `yarn workspace native lint` pass. Not run on a device.

## Known Stubs

None.

## Self-Check: PASSED
