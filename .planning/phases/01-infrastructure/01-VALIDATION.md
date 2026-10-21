---
phase: 01
slug: infrastructure
status: draft
nyquist_compliant: false
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
| 01-XX-XX | — | — | INFRA-01 | unit + integration | `yarn workspace api test:unit -t worker` | ❌ W0 | ⬜ pending |
| 01-XX-XX | — | — | INFRA-02 | integration | `yarn workspace api test:integration capture` | ❌ W0 | ⬜ pending |
| 01-XX-XX | — | — | INFRA-02 | unit | `yarn workspace api test:unit -t poseCaptureService` | ❌ W0 | ⬜ pending |
| 01-XX-XX | — | — | INFRA-03 | integration | `yarn workspace api test:integration status` | ❌ W0 | ⬜ pending |
| 01-XX-XX | — | — | INFRA-03 | unit | `yarn workspace api test:unit -t progress` | ❌ W0 | ⬜ pending |
| 01-XX-XX | — | — | INFRA-04 | unit + integration | `yarn workspace api test:unit -t reaper` | ❌ W0 | ⬜ pending |
| 01-XX-XX | — | — | INFRA-04 | unit | `yarn workspace api test:unit -t env` | ✅ (extend) | ⬜ pending |
| 01-XX-XX | — | — | INFRA-05 | manual | `eas build --profile development-simulator --platform ios` | manual-only | ⬜ pending |

*Task IDs and plan/wave columns are filled in once plans exist.*
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
