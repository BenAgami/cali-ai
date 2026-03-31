---
phase: 2
slug: user-profile
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.17 + Supertest 7.2.2 |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `yarn workspace api test --reporter=verbose --testPathPattern="users"` |
| **Full suite command** | `yarn workspace api test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `yarn workspace api test --reporter=verbose --testPathPattern="users"`
- **After every plan wave:** Run `yarn workspace api test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| PROF-01 | API | 1 | PROF-01 | integration | `yarn workspace api test --testPathPattern="updateProfile"` | ❌ Wave 0 | ⬜ pending |
| PROF-02 | API | 1 | PROF-02 | integration | `yarn workspace api test --testPathPattern="avatarUpload"` | ❌ Wave 0 | ⬜ pending |
| PROF-03 | API | 1 | PROF-03 | integration | covered in updateProfile test | ❌ Wave 0 | ⬜ pending |
| PROF-04 | API | 1 | PROF-04 | integration | `yarn workspace api test --testPathPattern="goals"` | ❌ Wave 0 | ⬜ pending |
| PROF-05 | API | 1 | PROF-05 | integration | covered in updateProfile test | ❌ Wave 0 | ⬜ pending |
| NOTF-01 | Native | 2 | NOTF-01 | manual-only | n/a — client-side only | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/tests/integration/users/updateProfile.test.ts` — stubs for PROF-01, PROF-03, PROF-05
- [ ] `apps/api/src/tests/integration/users/avatarUpload.test.ts` — stubs for PROF-02
- [ ] `apps/api/src/tests/integration/users/goals.test.ts` — stubs for PROF-04
- [ ] `apps/api/src/tests/integration/helpers/requestSender/usersRequests.ts` — add `patchMyProfile`, `postAvatarUploadUrl`, `postMyGoal` helpers

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Local notification fires at scheduled time | NOTF-01 | Client-side Expo Notifications — no server component | Open app → Profile → set reminder → wait for notification at scheduled time |
| Avatar renders after upload | PROF-02 | Requires live R2/presigned URL | Upload avatar → verify image displays on profile screen without logout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
