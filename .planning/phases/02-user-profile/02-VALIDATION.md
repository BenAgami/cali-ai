---
phase: 2
slug: user-profile
status: draft
nyquist_compliant: true
wave_0_complete: true
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

## Test Creation Approach

Tests are created **inline in Plan 02-01 Task 2** alongside the controllers and routes they verify. This is an integrated approach (not a separate Wave 0) because:

1. The test files (`updateProfile.test.ts`, `avatarUpload.test.ts`, `goals.test.ts`) are created in the same task that creates the endpoints they test.
2. Task 1 builds the service layer and schemas; Task 2 builds controllers, routes, AND tests together. The tests run as the final verification step of Task 2.
3. No separate Wave 0 plan is needed because there is no gap between "test creation" and "implementation" -- they are co-located in the same task, and the `<verify>` command (`yarn workspace api test`) runs all tests including the new ones.

This satisfies Nyquist because every code-producing task has an `<automated>` verify command that exercises the new code.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| PROF-01 | 02-01 | 1 | PROF-01 | integration | `yarn workspace api test --testPathPattern="updateProfile"` | Created in 02-01 Task 2 | pending |
| PROF-02 | 02-01 | 1 | PROF-02 | integration | `yarn workspace api test --testPathPattern="avatarUpload"` | Created in 02-01 Task 2 | pending |
| PROF-03 | 02-01 | 1 | PROF-03 | integration | covered in updateProfile test | Created in 02-01 Task 2 | pending |
| PROF-04 | 02-01 | 1 | PROF-04 | integration | `yarn workspace api test --testPathPattern="goals"` | Created in 02-01 Task 2 | pending |
| PROF-05 | 02-01 | 1 | PROF-05 | integration | covered in updateProfile test | Created in 02-01 Task 2 | pending |
| NOTF-01 | 02-03 | 3 | NOTF-01 | manual-only | n/a -- client-side only | n/a | pending |

*Status: pending / green / red / flaky*

---

## Mock Exception

`avatarUpload.test.ts` uses `vi.mock` for `@aws-sdk/s3-request-presigner` and `r2Client`. This is an intentional, documented exception to the project's no-mock integration test norm. Rationale: the behavior under test is the application's response shape and status code for the presigned URL endpoint, not the external R2 service itself. Vitest's module mock system is enabled by default; `apps/api/vitest.config.ts` is listed in `read_first` for 02-01 Task 2 to confirm compatibility.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Local notification fires at scheduled time | NOTF-01 | Client-side Expo Notifications -- no server component | Open app -> set reminder -> wait for notification at scheduled time |
| Avatar renders after upload | PROF-02 | Requires live R2/presigned URL | Upload avatar -> verify image displays on profile screen without logout |
| Profile shows updated data after edit without logout | PROF-05 | UI behavior (useFocusEffect re-fetch) | Edit profile -> save -> back nav -> verify data refreshed |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or inline test creation
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Test files created in same task as implementation (integrated approach)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (integrated test approach)
