---
phase: 05-ai-form-analysis-camera-post-set
plan: 12
subsystem: native-ui
tags: [react-native, expo-router, accessibility, form-feedback]
requires:
  - phase: 05-04
    provides: shared form analysis contracts in @repo/common
  - phase: 05-08
    provides: analysis tracker, useSessionAnalysis, useRecordedSets
provides:
  - Contrast-checked band colour tokens and form copy constants
  - BandBadge, DimensionRow, FeedbackBlocks, CameraAdvice, AnalysingRow, RecordedSetCard
  - /analysis-result deep-link screen (banner target)
  - "Recorded sets" section on workout detail with live progress, retry, New badge
affects: [05-15, 05-18]
tech-stack:
  added: []
  patterns: [thin screens with hook orchestration, label always printed beside band colour]
key-files:
  created:
    - apps/native/src/theme/formBands.ts
    - apps/native/src/constants/formMessages.ts
    - apps/native/src/components/form/BandBadge.tsx
    - apps/native/src/components/form/DimensionRow.tsx
    - apps/native/src/components/form/FeedbackBlocks.tsx
    - apps/native/src/components/form/CameraAdvice.tsx
    - apps/native/src/components/form/AnalysingRow.tsx
    - apps/native/src/components/form/RecordedSetCard.tsx
    - apps/native/src/hooks/useWorkoutRecordedSets.ts
    - apps/native/src/hooks/useAnalysisResultScreen.ts
    - apps/native/app/(main)/analysis-result.tsx
  modified:
    - apps/native/app/(main)/workout-detail.tsx
    - apps/native/app/(main)/_layout.tsx
key-decisions:
  - "Retry state and async handling live in useWorkoutRecordedSets (retrySet/retryingIds) so workout-detail stays JSX-only"
  - "useFocusEffect imported from expo-router (as other screens do); @react-navigation/native is not a declared dependency and Knip rejects it"
requirements-completed: [FORM-04, FORM-05, FORM-06, FORM-07, FORM-08, FORM-09, NOTF-02]
duration: 25min
completed: 2026-11-09
---

# Phase 5 Plan 12: Result, advice and recorded-sets UI Summary

Band-labelled result screen, untrackable camera advice, and a live "Recorded sets" section on workout detail; no numeric score is rendered anywhere.

## Tasks

1. Band tokens, copy and components - b2eba7c
2. analysis-result deep-link screen + layout registration - 4b02ca2
3. Recorded sets section with live analysing/failed rows - c499bc8

## Verification

- `yarn workspace native check-types` and `lint` pass; prettier clean on all plan files.
- Contrast script: all six colour pairs >= 4.5:1.
- Knip reports nothing for plan files (remaining findings are other plans' files).
- Not verified on device; UI behaviour is deferred to the 05-18 UAT.

## Deviations from Plan

**1. [Rule 3 - Blocking] useFocusEffect import source**
- Plan implied react-navigation; `@react-navigation/native` is not a declared dependency (Knip unlisted). Used `useFocusEffect` from `expo-router`, as workouts.tsx does.

**2. [Rule 2 - Knip] Non-exported constants**
- `ANALYSIS_FAILURE_MESSAGES` and `FAILURE_FALLBACK_MESSAGE` are module-private (consumed via exported `failureMessage`), to keep Knip clean. `RETRYABLE_FAILURES` is typed `ReadonlySet<string>` so raw failure strings can be checked.

**3. Retry handling moved into hook**
- Plan placed pending-retry state in the screen; moved into `useWorkoutRecordedSets` per thin-screen rule.

## Known Stubs

None. `/record-set` (Record again) targets a screen created in 05-15 and is pushed by string path.

## Self-Check: PASSED
