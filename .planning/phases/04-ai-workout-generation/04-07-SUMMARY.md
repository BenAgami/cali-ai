---
phase: 04-ai-workout-generation
plan: 07
subsystem: native
tags: [react-native, expo-router, body-metrics, units, api-client]
requires:
  - phase: 04-02
    provides: bodyMetricInputSchema, SaveBodyMetricResponse, UserProfile.bodyMetric
provides:
  - ApiError.code and per-request timeout on apiClient.post
  - Shared BodyMetricsForm + useBodyMetricsForm (region-based units, cm/kg submit)
  - Optional onboarding-body-metrics step after registration
  - Height/weight editing on Edit Profile, skipped when unchanged
affects: [04-08, 04-11]
tech-stack:
  added: []
  patterns: [Hermes Intl region detection instead of expo-localization]
key-files:
  created:
    - apps/native/src/utils/units.ts
    - apps/native/src/hooks/mutations/useSaveBodyMetrics.ts
    - apps/native/src/hooks/useBodyMetricsForm.ts
    - apps/native/src/components/BodyMetricsForm.tsx
    - apps/native/app/(main)/onboarding-body-metrics.tsx
  modified:
    - apps/native/src/api/errors.ts
    - apps/native/src/api/client.ts
    - apps/native/src/api/endpoints/user.ts
    - apps/native/src/constants/routes.ts
    - apps/native/app/(main)/_layout.tsx
    - apps/native/src/hooks/useRegister.ts
    - apps/native/src/hooks/useProfileEdit.ts
    - apps/native/app/(main)/profile-edit.tsx
key-decisions:
  - "Until the user edits, the form reports the stored metric exactly, so imperial whole-inch rounding never counts as a change"
requirements-completed: [PROF-06]
duration: 25min
completed: 2026-11-04
---

# Phase 4 Plan 07: Native Body Metrics Summary

One shared height/weight form (metric/imperial, region default via Hermes Intl, always submits cm/kg) used by a skippable post-registration step and Edit Profile, plus ApiError `code` and per-request timeout plumbing.

## Tasks

1. Client plumbing, units util, save hook: 403417e
2. Shared form, hook, onboarding screen, register redirect: 62f790e
3. Edit Profile height/weight with skip-if-unchanged: 65f248a

## Deviations from Plan

None in scope. Added a `seeded` baseline in `useBodyMetricsForm` (not specified) so imperial rounding does not make an untouched form look changed, which would violate "an unchanged save sends no body-metrics request".

## Verification

`yarn workspace native check-types` and `lint` pass; prettier clean on touched files. Device behaviour is verified in plan 04-11.

## Known Stubs

None.

## Self-Check: PASSED
