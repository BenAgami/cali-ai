---
phase: 04-ai-workout-generation
plan: 01
subsystem: database, api
tags: [prisma, migration, errors, env, zod, anthropic]
requires: []
provides:
  - WorkoutGeneration table, AI consent columns, nullable experience level, Workout AI provenance
  - dip exercise in seed
  - ApiError.code plus PreconditionRequiredError (428) and TooManyRequestsError (429)
  - env.llm and env.aiGeneration config
affects: [04-02, 04-03, 04-04, 04-05]
tech-stack:
  added: []
  patterns: [machine-readable ApiError code, production-only required secret in env superRefine]
key-files:
  created:
    - packages/database/prisma/models/workout-generation.prisma
    - packages/database/prisma/migrations/20261104100000_ai_workout_generation/migration.sql
    - apps/api/src/errors/PreconditionRequiredError.ts
    - apps/api/src/errors/TooManyRequestsError.ts
  modified:
    - packages/database/prisma/enums.prisma
    - packages/database/prisma/models/user.prisma
    - packages/database/prisma/models/workout.prisma
    - packages/database/prisma/seed.ts
    - apps/api/src/errors/ApiError.ts
    - apps/api/src/config/env.ts
    - apps/api/tests/unit/helpers/prismaMock.ts
    - apps/api/tests/integration/helpers/testSetup.ts
key-decisions:
  - "A saved workout is AI-generated iff aiModel is non-null"
  - "ANTHROPIC_API_KEY required only in production; deadline must cover 2 primary + 1 fallback attempt"
duration: 20min
completed: 2026-11-04
---

# Phase 4 Plan 01: Foundation Summary

One Prisma migration (consent, nullable level, WorkoutGeneration, Workout provenance), dip seed, coded 428/429 API errors and validated LLM/generation env config.

## Tasks

1. Schema, migration, seed, test helpers: a2bf31a
2. Error codes and 428/429 classes: c258ea4
3. LLM and generation env vars: c31a27f

## Deviations from Plan

**[Rule 3 - Blocking] Migration created via `prisma migrate diff`.** `migrate dev` refuses to run non-interactively, so the SQL was generated with `migrate diff --from-config-datasource --to-schema` into `20261104100000_ai_workout_generation`, then applied with `migrate deploy`. The SQL contains DROP NOT NULL/DROP DEFAULT, the enum, table and unique index.

**[Rule 3 - Blocking] Rebuilt `@repo/db`** (`yarn workspace @repo/db build`) because `apps/api` type-checks against `dist`.

## Verification

- `yarn workspace api test:unit`: 430 passed; `check-types` passes for db and api.
- Dev DB has the `dip` exercise row.

## Known Stubs

None.

## Self-Check: PASSED
