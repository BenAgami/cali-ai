---
phase: 01-infrastructure
plan: 02
subsystem: api
tags: [redis, pubsub, zod, env-config, sse-contract]
requires: []
provides:
  - "ANALYSIS_STAGES, analysisStatusEventSchema, AnalysisStatusEvent in @repo/common"
  - "progressPercent / toStatusEvent pure stage-to-percent mapping"
  - "env.analysis.* config with retry-budget refinement"
  - "Redis pub/sub progressBus on a dedicated subscriber connection"
affects: [01-05, 01-08, 01-09]
tech-stack:
  added: []
  patterns:
    - "Single stage-to-range table; percent derived, never stored"
    - "Zod 4 superRefine inside envSchema keeps ZodObject.shape"
    - "Lazy dedicated ioredis subscriber, per-session channel fan-out"
key-files:
  created:
    - packages/common/src/validations/analysis.ts
    - apps/api/src/utils/analysisProgress.ts
    - apps/api/src/lib/progressBus.ts
    - apps/api/tests/unit/utils/analysisProgress.test.ts
    - apps/api/tests/unit/lib/progressBus.test.ts
  modified:
    - packages/common/src/index.ts
    - apps/api/src/config/env.ts
    - apps/api/src/lib/redis.ts
    - apps/api/tests/unit/helpers/unitEnv.ts
    - apps/api/tests/unit/config/env.test.ts
    - apps/api/.env.example
key-decisions:
  - "Stage ranges QUEUED 0-10, ANALYZING_REPS 10-60, WRITING_FEEDBACK 60-95, COMPLETED 100; in-progress capped at 99"
  - "Env refuses to boot unless stuck timeout > retry budget (141000 ms default) and stuck + reaper <= 180000 ms"
requirements-completed: [INFRA-03, INFRA-04]
duration: 25min
completed: 2026-10-22
---

# Phase 1 Plan 02: Analysis Progress Contract and Progress Bus Summary

Shared status-event schema, one stage-to-percent table, env-enforced stuck-timeout budget (both bounds), and a Redis pub/sub progress bus with a lazy dedicated subscriber.

## Tasks

| Task | Commit |
| ---- | ------ |
| 1 RED: failing progress mapping tests | 4632fd8 |
| 1 GREEN: status-event contract + progress mapping | a505a18 |
| 2: analysis env vars with refinement | 179b067 |
| 3 RED: failing progress bus tests | b4e2773 |
| 3 GREEN: progress bus + createRedisConnection | 50f7a03 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Workspace packages were not built**
- **Found during:** Task 1 RED run (every suite failed to resolve `@repo/db` / `@repo/common`)
- **Fix:** Ran `db:generate` (with a dummy `DATABASE_URL`), then built `@repo/db`, `@repo/common` and `@repo/eslint-config`. Build output is gitignored; no files committed.

None otherwise - plan executed as written.

## Verification

- `yarn workspace api test:unit`: 28 files, 318 tests pass
- `yarn workspace api check-types` and `yarn workspace api lint` pass; prettier check clean on touched trees
- `yarn knip` reports only untracked `scripts/pose-eval/.venv` files that belong to other work (out of scope)

## Known Stubs

None.

## Self-Check: PASSED
