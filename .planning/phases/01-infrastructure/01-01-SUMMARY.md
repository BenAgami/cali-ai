---
phase: 01-infrastructure
plan: 01
subsystem: database
tags: [prisma, postgres, bullmq, pose-capture, migration]

requires: []
provides:
  - PoseCapture model/table (one row per session, gzipped keypoints blob + metadata)
  - AnalysisStage enum and workout_sessions.analysis_stage / analysis_stage_progress columns
  - Video-free session API (no videoMeta, no video_* columns)
  - BullMQ queue form-analysis with AnalysisJobData { sessionId, captureId }
affects: [01-02, 01-03, 01-05, 01-07, 01-08]

tech-stack:
  added: []
  patterns:
    - "Stage and sub-progress persisted as columns on WorkoutSession; percent never stored"

key-files:
  created:
    - packages/database/prisma/models/pose-capture.prisma
    - packages/database/prisma/migrations/20261022075507_pose_capture_and_analysis_stage/migration.sql
  modified:
    - packages/database/prisma/enums.prisma
    - packages/database/prisma/models/workout-session.prisma
    - docs/data-model.md
    - packages/common/src/validations/workoutSession.ts
    - apps/api/src/lib/queue.ts
    - apps/api/src/lib/shutdown.ts
    - apps/api/src/lib/r2.ts
    - apps/api/src/openapi/schemas.ts
    - apps/api/src/controllers/workoutSession.ts
    - apps/api/src/services/workoutSessionService.ts

key-decisions:
  - "Stage/progress stored as WorkoutSession columns, not a new AnalysisJob table"
  - "R2 socket limits hardcoded (15/5) now that the video worker constant is gone"

patterns-established: []

requirements-completed: [INFRA-01, INFRA-02, INFRA-04]

duration: 40min
completed: 2026-10-22
---

# Phase 1 Plan 01: Data Foundation Summary

**Prisma migration adding PoseCapture + AnalysisStage, dropping all video columns, and renaming the BullMQ queue to `form-analysis` with `{ sessionId, captureId }` job data.**

## Tasks

| Task | Commit | Notes |
| ---- | ------ | ----- |
| 1. Schema + migration + data-model doc | 2df7028 | applied to dev (:5434) and test (:5433) |
| 2. Remove video from common/API source, rename queue | 3fb1e6b | constants.ts deleted |
| 3. Update unit + integration tests | ee2a5bb | unit 315 pass, integration 97 pass |

## Deviations from Plan

**1. [Rule 3 - Blocking] Dev DB migration history was out of sync**
- Dev DB had `workouts` tables already present but migration `20260502000000_add_workout_tables` unrecorded, so `migrate deploy` failed. Verified via `migrate diff` that the schema matched, then marked it applied with `migrate resolve --applied`, and applied `add_refresh_tokens` normally.
- My first generated migration.sql was captured before `refresh_tokens` was applied and then partially applied (Prisma does not wrap a failed script atomically), so the saved SQL was wrong. I rewrote migration.sql with the complete intended SQL, validated it on the clean test DB, and re-synced the dev `_prisma_migrations` row. Final `migrate diff` against dev reports no difference.
- Dev DB only: removed my own stale `_prisma_migrations` rows for this migration.

**2. [Plan inconsistency] `grep -n "video" apps/api/tests` is not empty**
- The plan's own Task 3 step 5 requires `not.toHaveProperty("videoDurationSec")` in createWorkoutSession.test.ts; that single regression assertion is the only match.

**3. `prisma format` reformatted unrelated models** (exercise, workout, body-metric, user-goal); I reverted/did not commit those.

## Verification

- `check-types`, `test:unit`, `test:integration`, `format:check`, `deps:lint` green.
- `yarn lint` on api: clean after removing `serializeSession`.
- `yarn knip`: only `FORM_ANALYSIS_QUEUE_NAME` and `ANALYSIS_JOB_NAME` unused (expected; consumed by plans 01-07/01-08). The scripts/pose-eval `.venv` noise in knip output is pre-existing and unrelated.

## Known Stubs

None.

## Self-Check: PASSED
