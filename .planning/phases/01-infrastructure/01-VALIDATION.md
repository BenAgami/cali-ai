---
phase: 01
slug: infrastructure
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-22
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (two projects: unit, integration) + Supertest |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `yarn workspace api test:unit` |
| **Full suite command** | `yarn workspace api test` (needs Postgres :5433 and Redis) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `yarn workspace api test:unit`, `yarn lint`, `yarn check-types`
- **After every plan wave:** Run `yarn workspace api test`, `yarn format:check`, `yarn knip`, `yarn deps:lint`
- **Before `/gsd:verify-work`:** Full suite must be green, plus recorded Android gate evidence
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INFRA-02, INFRA-04 | migration | `npx prisma migrate status` (packages/database) | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | INFRA-01 | lint | `yarn workspace api lint` | ✅ | ⬜ pending |
| 01-01-03 | 01 | 1 | INFRA-01, INFRA-02 | unit + integration | `yarn workspace api test` | ✅ (update) | ⬜ pending |
| 01-02-01 | 02 | 1 | INFRA-03 | unit (TDD) | `yarn workspace api test:unit -t progressPercent` | ❌ W0 (created in task) | ⬜ pending |
| 01-02-02 | 02 | 1 | INFRA-04 | unit | `yarn workspace api test:unit -t "envSchema|retry budget"` (incl. timeout + reaper interval <= 180 s) | ✅ (extend) | ⬜ pending |
| 01-02-03 | 02 | 1 | INFRA-03 | unit (TDD) | `yarn workspace api test:unit -t progressBus` | ❌ W0 (created in task) | ⬜ pending |
| 01-03-01 | 03 | 1 | INFRA-05 | bundle + types | `npx expo export --platform android` + `yarn workspace native check-types` | n/a | ⬜ pending |
| 01-03-02 | 03 | 1 | INFRA-05 | EAS build | `npx eas-cli build:list --limit 2 --json` | n/a | ⬜ pending |
| 01-03-03 | 03 | 1 | INFRA-05 | manual (device) | checkpoint | manual-only | ⬜ pending |
| 01-04-01 | 04 | 1 | INFRA-05 | script self-test | `download_models.py` (tfhub -> Kaggle fallback, TFL3 check) + `evaluate.py --self-test` | ❌ W0 (created in task) | ⬜ pending |
| 01-04-02 | 04 | 1 | INFRA-05 | manual (filming) | checkpoint | manual-only | ⬜ pending |
| 01-04-03 | 04 | 1 | INFRA-05 | script run | `test -s scripts/pose-eval/results/summary.csv` | n/a | ⬜ pending |
| 01-05-01 | 05 | 2 | INFRA-04 | unit (TDD) | `yarn workspace api test:unit -t analysisStateService` | ❌ W0 (created in task) | ⬜ pending |
| 01-05-02 | 05 | 2 | INFRA-04 | integration | `yarn workspace api test:integration sessionAnalysis` | ❌ W0 (created in task) | ⬜ pending |
| 01-06-01 | 06 | 2 | INFRA-02 | unit (TDD) | `yarn workspace api test:unit -t captureCodec` | ❌ W0 (created in task) | ⬜ pending |
| 01-06-02 | 06 | 2 | INFRA-01 | unit (TDD) | `yarn workspace api test:unit -t withTimeout` | ❌ W0 (created in task) | ⬜ pending |
| 01-07-01 | 07 | 3 | INFRA-02 | unit (TDD) | `yarn workspace api test:unit -t captureService` | ❌ W0 (created in task) | ⬜ pending |
| 01-07-02 | 07 | 3 | INFRA-02 | unit + types | `yarn workspace api test:unit -t rejectOversizedBody` | ❌ W0 (created in task) | ⬜ pending |
| 01-07-03 | 07 | 3 | INFRA-02, INFRA-04 | integration | `yarn workspace api test:integration sessions` | ❌ W0 (created in task) | ⬜ pending |
| 01-08-01 | 08 | 3 | INFRA-01 | unit (TDD) | `yarn workspace api test:unit -t analysisProcessor` | ❌ W0 (created in task) | ⬜ pending |
| 01-08-02 | 08 | 3 | INFRA-04 | unit (TDD) | `yarn workspace api test:unit -t "shutdown|reaper"` | ✅ (extend) | ⬜ pending |
| 01-08-03 | 08 | 3 | INFRA-01 | integration | `yarn workspace api test:integration workers` | ❌ W0 (created in task) | ⬜ pending |
| 01-09-01 | 09 | 4 | INFRA-03 | unit (TDD) | `yarn workspace api test:unit -t "openSseStream|sse|analysisStreamService"` | ❌ W0 (created in task) | ⬜ pending |
| 01-09-02 | 09 | 4 | INFRA-03 | unit (TDD) | `yarn workspace api test:unit -t streamAnalysisStatus` | ❌ W0 (created in task) | ⬜ pending |
| 01-09-03 | 09 | 4 | INFRA-03 | integration | `yarn workspace api test:integration analysisStatusStream` | ❌ W0 (created in task) | ⬜ pending |
| 01-10-01 | 10 | 5 | INFRA-02 | types + lint | `yarn workspace native check-types` | n/a | ⬜ pending |
| 01-10-02 | 10 | 5 | INFRA-03 | types + bundle | `npx expo export --platform android` + `yarn knip` | n/a | ⬜ pending |
| 01-10-03 | 10 | 5 | INFRA-02, INFRA-03 | manual (device) | checkpoint | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/tests/unit/helpers/` — fake BullMQ `Job` factory; progress bus mock
- [ ] `apps/api/tests/integration/helpers` — Redis queue cleanup; SSE reader helper (streaming `http.get`)
- [ ] Update `tests/unit/lib/shutdown.test.ts` and `tests/unit/helpers/unitEnv.ts` for new modules/vars
- [ ] Update existing `createWorkoutSession` integration tests and OpenAPI after removing `videoMeta`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Android dev build launches, model loads, pose pass runs on a test image/video | INFRA-05 | Needs device/emulator and EAS | Install the dev build, run the pose smoke screen, record result |
| iOS simulator build compiles | INFRA-05 | Needs EAS | `eas build --profile development-simulator --platform ios` from `apps/native` |
| MoveNet vs 33-point model decision on real clips | Gate | Needs real footage | Run the offline script over the shot list, log the decision |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
