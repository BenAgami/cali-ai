---
phase: 04-ai-workout-generation
plan: 02
subsystem: shared-contracts
tags: [zod, common, openapi, profile]
requires: []
provides:
  - bodyMetricInputSchema, bodyMetricSchema, saveBodyMetricResponseSchema
  - AI_CONSENT_VERSION, aiConsentSchema, getMissingAiPrerequisites
  - generateWorkoutSchema, workoutGenerationPreviewSchema
  - nullable experienceLevel plus bodyMetric/aiConsent fields on userProfileSchema
  - workout provenance fields (generationId, aiModel)
affects: [04-03, 04-06, 04-07, 04-08]
key-files:
  created:
    - packages/common/src/validations/bodyMetric.ts
    - packages/common/src/validations/aiPrerequisites.ts
    - packages/common/src/validations/workoutGeneration.ts
  modified:
    - packages/common/src/validations/user.ts
    - packages/common/src/validations/workout.ts
    - packages/common/src/index.ts
    - apps/api/src/openapi/schemas.ts
    - apps/native/app/(main)/profile.tsx
    - apps/native/src/hooks/useProfileEdit.ts
key-decisions:
  - "Prerequisite codes reported in fixed order PROFILE_INCOMPLETE, BODY_METRICS_REQUIRED, AI_CONSENT_REQUIRED"
metrics:
  completed: 2026-11-04
  tasks: 2
  files: 9
---

# Phase 4 Plan 02: Shared Phase 4 contracts Summary

All Phase 4 request/response contracts now live once in `@repo/common`, and the nullable fitness level is handled in the OpenAPI schemas and native profile screens.

## Commits

- f4190d4: shared schemas (task 1)
- 682beb7: OpenAPI and native profile ripple (task 2)

## Deviations from Plan

None to the plan's scope. Note: native resolves `@repo/common` through its built `dist`, so `yarn workspace @repo/common build` is needed before native type-checks see new schema fields (the dist is gitignored).

## Known Stubs

None.

## Notes

- `yarn workspace api check-types` showed a transient error (`workoutGeneration` missing on PrismaClient) from plan 04-01's in-progress Prisma changes; it cleared once the client was regenerated and is outside this plan.
- Knip may flag the new exports as unused until plans 04-03/06/07/08 consume them (expected, gated in 04-11).

## Self-Check: PASSED
