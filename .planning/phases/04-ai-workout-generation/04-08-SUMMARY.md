---
phase: 04-ai-workout-generation
plan: 08
subsystem: native-ui
tags: [react-native, expo-router, react-query, ai-generation, consent]
requires:
  - phase: 04-07
    provides: ApiError, BodyMetricsForm, useBodyMetricsForm, useSaveBodyMetrics, useProfile
  - phase: 04-03
    provides: AI prerequisite gate and consent endpoint
provides:
  - Generate with AI flow on the workouts tab (prerequisites, consent, goal box, preview, save, regenerate)
  - AiDisclaimer component reusable on the Start screen (plan 04-10)
key-files:
  created:
    - apps/native/src/constants/aiMessages.ts
    - apps/native/src/hooks/mutations/useGenerateWorkout.ts
    - apps/native/src/hooks/mutations/useAcceptAiConsent.ts
    - apps/native/src/components/AiDisclaimer.tsx
    - apps/native/src/components/AiConsentNotice.tsx
    - apps/native/src/components/AiProfilePrerequisite.tsx
    - apps/native/src/hooks/useWorkoutGenerate.ts
    - apps/native/app/(main)/workout-generate.tsx
  modified:
    - apps/native/src/constants/routes.ts
    - apps/native/src/api/endpoints/workouts.ts
    - apps/native/src/api/endpoints/user.ts
    - apps/native/app/(main)/_layout.tsx
    - apps/native/app/(main)/(tabs)/workouts.tsx
key-decisions:
  - "Step is derived from getMissingAiPrerequisites on the GET /me profile; a 428 from the server refetches the profile so the right inline form appears"
  - "Consent body text lives in aiMessages.ts (AI_CONSENT_BODY_TEXT) so the copy stays on one line and in one place"
metrics:
  tasks: 3
  files: 13
completed: 2026-11-04
---

# Phase 4 Plan 08: Generate with AI Native Flow Summary

User-facing WKT-05 flow: a "Generate with AI" pill on the workouts tab opens a thin screen that walks the user through missing profile, body metrics and one-time Anthropic privacy consent inline, then takes a free-text goal (with example chips), shows a 75 s-timeout loading state, and previews the plan with disclaimer, note, Save (sends generationId) and Regenerate.

## Commits

- 9d194c4 endpoints, mutations, AI messages
- 9f9bb49 AI disclaimer, consent notice, profile prerequisite components
- 659568c useWorkoutGenerate hook, screen, layout entry, workouts entry point

## Deviations from Plan

- The acceptance check for `AiConsentNotice.tsx` expects the literal `height, weight` and `Anthropic` in that file. The text is rendered from `AI_CONSENT_BODY_TEXT` in `aiMessages.ts` (which contains both) because Prettier wraps JSX text across lines. Behavior is as specified.
- Added `AI_ALREADY_SAVED_TEXT` constant for the GENERATION_ALREADY_SAVED message rather than an inline string.
- Used `missing.at(0)` in the hook so TypeScript does not narrow `step` to exclude `"READY"`.

## Open items

- Legal review of the consent wording is still open (tracked in STATE.md concerns).
- `yarn knip` currently reports two API findings from plan 04-04/04-05 work (`workoutGenerationService` default export, `LlmErrorCode` type), not from this plan.
- On-device verification is plan 04-11.

## Known Stubs

None.

## Verification

`yarn workspace native check-types`, `yarn workspace native lint` and `prettier --check apps/native` pass.

## Self-Check: PASSED
