---
phase: 4
slug: ai-workout-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-04
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (two projects: unit, integration) |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `yarn workspace api test:unit` |
| **Full suite command** | `yarn workspace api test` (needs Docker Postgres :5433) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `yarn workspace api test:unit`
- **After every plan wave:** Run `yarn workspace api test`, `yarn lint`, `yarn check-types`, `yarn knip`
- **Before `/gsd:verify-work`:** Full suite plus `yarn format:check` and `yarn deps:lint` must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-XX-XX | TBD | TBD | WKT-05 | unit | `yarn workspace api test:unit workoutGenerationService` | ❌ W0 | ⬜ pending |
| 4-XX-XX | TBD | TBD | WKT-05 | integration | `yarn workspace api test:integration workoutGeneration` | ❌ W0 | ⬜ pending |
| 4-XX-XX | TBD | TBD | WKT-06 | unit | `yarn workspace api test:unit workoutGenerationService` | ❌ W0 | ⬜ pending |
| 4-XX-XX | TBD | TBD | WKT-07 | unit | `yarn workspace api test:unit aiPrerequisites` / `workoutPlanPrompt` | ❌ W0 | ⬜ pending |
| 4-XX-XX | TBD | TBD | PROF-06 | unit + integration | `yarn workspace api test bodyMetricService` | ❌ W0 | ⬜ pending |
| 4-XX-XX | TBD | TBD | D-18 | unit (fake timers) | `yarn workspace api test:unit workoutGenerationService` | ❌ W0 | ⬜ pending |
| 4-XX-XX | TBD | TBD | D-09/D-21 | integration | `yarn workspace api test:integration workout` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/tests/unit/helpers/fakeLlmProvider.ts` — fake provider for the generation service
- [ ] unit tests: workoutGenerationService, bodyMetricService, aiPrerequisites, anthropicProvider error mapping (SDK client mocked at the I/O boundary), workoutPlanPrompt, controller
- [ ] integration tests: generate, body-metrics, consent, save-with-provenance
- [ ] new env vars added to `apps/api/tests/unit/helpers/unitEnv.ts`
- [ ] `scripts/workout-eval/` golden set + knip ignore entry

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Beginner vs advanced plans differ for the same goal | WKT-07 | Needs a real model call and an API key; not CI-safe | `yarn tsx scripts/workout-eval/run.ts` and compare outputs |
| Disclaimer shown on preview and on Start for AI workouts | WKT-05 | No RN screen test infra detected | Generate a plan, confirm the disclaimer on the preview and again before Start |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
