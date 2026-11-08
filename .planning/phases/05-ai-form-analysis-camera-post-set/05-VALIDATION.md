---
phase: 5
slug: ai-form-analysis-camera-post-set
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-08
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Full test map: `05-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (two projects: unit, integration) + Supertest in `apps/api`; no native test runner |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `yarn workspace api test:unit` |
| **Full suite command** | `yarn workspace api test` (needs Docker Postgres :5433 and Redis) |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `yarn workspace api test:unit` (plus `yarn check-types` for native-touching tasks)
- **After every plan wave:** Run `yarn workspace api test`, `yarn lint`, `yarn format:check`, `yarn knip`, `yarn deps:lint`
- **Before `/gsd:verify-work`:** Full suite green, then Android device UAT
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-XX-XX | TBD | TBD | FORM-01 | unit + integration | `yarn workspace api test:unit -t "supported exercise"` | ❌ W0 | ⬜ pending |
| 5-XX-XX | TBD | TBD | FORM-03 | unit + integration | `yarn workspace api test:integration -t "capture"` | ⚠️ partial | ⬜ pending |
| 5-XX-XX | TBD | TBD | FORM-04 | unit | `yarn workspace api test:unit tests/unit/metrics/scoring.test.ts` | ❌ W0 | ⬜ pending |
| 5-XX-XX | TBD | TBD | FORM-05 | unit | `yarn workspace api test:unit tests/unit/metrics/computeFormMetrics.test.ts` | ❌ W0 | ⬜ pending |
| 5-XX-XX | TBD | TBD | FORM-06/07 | unit | `yarn workspace api test:unit tests/unit/services/feedbackService.test.ts` | ❌ W0 | ⬜ pending |
| 5-XX-XX | TBD | TBD | FORM-08 | integration | `yarn workspace api test:integration -t "analysis result"` | ❌ W0 | ⬜ pending |
| 5-XX-XX | TBD | TBD | FORM-09 | unit | `yarn workspace api test:unit tests/unit/metrics/trackability.test.ts` | ❌ W0 | ⬜ pending |
| 5-XX-XX | TBD | TBD | PROF-07 | unit | `yarn workspace api test:unit tests/unit/prompts/formFeedbackPrompt.test.ts` | ❌ W0 | ⬜ pending |
| 5-XX-XX | TBD | TBD | cross | unit | `yarn workspace api test:unit tests/unit/metrics/segmentReps.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/tests/unit/metrics/*.test.ts` and `fixtures/` — quantized skeleton JSON from the 16 evaluation clips (skeleton only, no imagery)
- [ ] `apps/api/tests/unit/helpers/syntheticPose.ts` — parametric push-up/squat/pull-up/dip generator (known angles, sag, noise, dropouts, non-square aspect)
- [ ] Extend `apps/api/tests/unit/helpers/fakeLlmProvider.ts` for form feedback
- [ ] Integration tests: result endpoint, consent gate at capture
- [ ] New env vars (if any) added to `apps/api/tests/unit/helpers/unitEnv.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Record offer; camera opens only on accept | FORM-02 | No RN screen test infra | Android UAT: decline logs normally, accept opens camera |
| In-app toast with deep link to set | NOTF-02 | Device UI | Finish a recorded set, confirm toast and deep link |
| Pose runtime spike (BlazePose on device) | FORM-02/03 | Needs a real Android device | Wave 0 spike per RESEARCH.md |
| Device UAT edge cases | FORM-09 | Device/camera | Permission denied, dark room, out of frame, airplane mode at Stop, backgrounded during analysis, retry after failure, Record again after untrackable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
