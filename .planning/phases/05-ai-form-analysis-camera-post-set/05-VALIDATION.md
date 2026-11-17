---
phase: 5
slug: ai-form-analysis-camera-post-set
status: approved
nyquist_compliant: true
wave_0_complete: true
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
| 5-04-01 | 05-04 | 1 | FORM-01/04/05/09 | unit | `yarn workspace api test:unit tests/unit/common/formAnalysis.test.ts` | ✅ | ✅ green |
| 5-04-02 | 05-04 | 1 | PROF-07 | unit | `yarn workspace api test:unit tests/unit/prompts/formFeedbackPrompt.test.ts` | ✅ | ✅ green |
| 5-05-01/02 | 05-05 | 2 | FORM-05/09 | unit | `yarn workspace api test:unit tests/unit/metrics/fixtures.test.ts` | ✅ | ✅ green |
| 5-06-01/02 | 05-06 | 2 | FORM-05/06 | unit | `yarn workspace api test:unit tests/unit/metrics/segmentReps.test.ts` | ✅ | ✅ green |
| 5-06-03 | 05-06 | 2 | FORM-09 | unit | `yarn workspace api test:unit tests/unit/metrics/trackability.test.ts` | ✅ | ✅ green |
| 5-07-01..03 | 05-07 | 2 | FORM-01/04, PROF-07 | integration | `yarn workspace api test:integration tests/integration/workoutSessions` | ✅ | ✅ green |
| 5-08-01/02 | 05-08 | 2 | FORM-08, NOTF-02 | type-check + manual | `yarn check-types` (banner: device UAT) | ✅ | ✅ green |
| 5-09-01/02 | 05-09 | 3 | FORM-05/06 | unit | `yarn workspace api test:unit tests/unit/metrics/rubrics` | ✅ | ✅ green |
| 5-10-01..03 | 05-10 | 3 | FORM-06/07, PROF-07 | unit | `yarn workspace api test:unit tests/unit/services/feedbackService.test.ts` | ✅ | ✅ green |
| 5-11-01..03 | 05-11 | 3 | FORM-03/04/05/08/09 | unit + integration | `yarn workspace api test:integration -t "analysis result"` | ✅ | ✅ green |
| 5-12-01..03 | 05-12 | 3 | FORM-04..09, NOTF-02 | type-check + manual | `yarn check-types` (screens: device UAT) | ✅ | ✅ green |
| 5-13-01/02 | 05-13 | 3 | FORM-02/03 | unit + manual | `yarn workspace api test:unit tests/unit/common/formSetup.test.ts` (camera: device UAT) | ✅ | ✅ green |
| 5-14-01/02 | 05-14 | 4 | FORM-04..07/09 | unit | `yarn workspace api test:unit tests/unit/metrics/computeFormMetrics.test.ts` | ✅ | ✅ green |
| 5-15-01..03 | 05-15 | 4 | FORM-01/02/03/08, PROF-07 | type-check + manual | `yarn check-types` (record flow: device UAT) | ✅ | ✅ green |
| 5-16-01..03 | 05-16 | 5 | FORM-03/04/06/07/08/09 | unit + integration | `yarn workspace api test:integration tests/integration/workers` | ✅ | ✅ green |
| 5-17-01..03 | 05-17 | 5 | FORM-04/05/07 | unit | `yarn workspace api test:unit tests/unit/metrics/scoring.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/api/tests/unit/metrics/*.test.ts` and `fixtures/` — quantized skeleton JSON from the 16 evaluation clips (skeleton only, no imagery)
- [x] `apps/api/tests/unit/helpers/syntheticPose.ts` — parametric push-up/squat/pull-up/dip generator (known angles, sag, noise, dropouts, non-square aspect)
- [x] Extend `apps/api/tests/unit/helpers/fakeLlmProvider.ts` for form feedback
- [x] Integration tests: result endpoint, consent gate at capture
- [x] New env vars (if any) added to `apps/api/tests/unit/helpers/unitEnv.ts`

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automated gates green (2026-11-10); device UAT tracked in `05-HUMAN-UAT.md`
