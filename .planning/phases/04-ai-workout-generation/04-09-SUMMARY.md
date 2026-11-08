---
phase: 04-ai-workout-generation
plan: 09
subsystem: api
tags: [llm, eval, anthropic, sonnet]
requires: ["04-04", "04-05"]
provides:
  - golden-set eval runner (yarn workspace api eval:workouts)
  - measured model decision (Sonnet primary)
key-files:
  created:
    - apps/api/scripts/workout-eval/goldenSet.ts
    - apps/api/scripts/workout-eval/run.ts
    - .planning/phases/04-ai-workout-generation/04-EVAL-RESULTS.md
  modified:
    - apps/api/src/config/env.ts
    - apps/api/.env.example
    - apps/api/tests/unit/helpers/unitEnv.ts
    - apps/api/tests/unit/config/env.test.ts
    - apps/api/tests/unit/services/workoutGenerationService.test.ts
    - apps/api/package.json
    - apps/api/tsconfig.json
    - .gitignore
key-decisions:
  - "Sonnet (claude-sonnet-5-5, effort medium) is primary, changing D-16; fallback rung is Sonnet at high effort"
metrics:
  completed: 2026-11-04
---

# Phase 4 Plan 09: Golden-set eval Summary

Golden-set eval (6 goals x 2 levels x 2 models) showed Haiku missing the D-22 thresholds (58% catalogValid, 33% levelDiffers, with timeouts and UNAVAILABLE errors) while Sonnet scored 100% on every criterion. The user chose option (b), so Sonnet is now the primary model.

## Commits

- 15d57c6: eval runner and golden set
- 110b745: recorded eval results
- 32d4f8a: Sonnet primary defaults

## Changes for the decision

- Defaults: primary `claude-sonnet-5-5` / `medium`, fallback `claude-sonnet-5-5` / `high` (escalation by effort, no new model). Timeouts and deadline unchanged.
- Unit tests updated; unit suite (504), check-types and lint pass.

## Deviations from Plan

None beyond the user-directed decision outcome (option b).

## Known Stubs

None.

## Open items

Haiku flakiness vs quality was not re-run (no more paid calls).

## Self-Check: PASSED
