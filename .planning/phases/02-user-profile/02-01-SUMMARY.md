---
phase: 02-user-profile
plan: 01
subsystem: api
tags: [prisma, zod, express, r2, s3, integration-tests, vitest]

# Dependency graph
requires: []
provides:
  - PATCH /api/users/me — update username, avatarUrl, experienceLevel
  - POST /api/users/me/avatar-upload-url — returns presigned R2 PUT URL
  - POST /api/users/me/goals — creates UserGoal record
  - GET /api/users/me — now returns avatarUrl, experienceLevel, and active goal
  - updateProfileSchema and upsertGoalSchema exported from @repo/common
affects: [02-02, 02-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - P2002 unique constraint detection without meta.target (Prisma 7 driver adapter omits target)
    - R2 presigned URL generation via PutObjectCommand + getSignedUrl
    - vi.mock for external AWS SDK calls in integration tests (documented exception to no-mock rule)

key-files:
  created:
    - packages/common/src/validations/user.ts
    - packages/database/prisma/migrations/20260401105540_add_avatar_url_to_user/migration.sql
    - apps/api/tests/integration/users/updateProfile.test.ts
    - apps/api/tests/integration/users/avatarUpload.test.ts
    - apps/api/tests/integration/users/goals.test.ts
  modified:
    - packages/database/prisma/models/user.prisma
    - packages/common/src/index.ts
    - apps/api/src/config/env.ts
    - apps/api/src/services/userService.ts
    - apps/api/src/controllers/user.ts
    - apps/api/src/routes/user.ts
    - apps/api/tests/integration/helpers/requestSender/usersRequests.ts

key-decisions:
  - "Catch P2002 without checking meta.target — Prisma 7 with pg driver adapter omits target field; checking code alone is sufficient for a user.update call where username is the only unique constraint"
  - "Mock getSignedUrl from @aws-sdk/s3-request-presigner in avatarUpload test — external I/O that requires live credentials; mocking is appropriate to test response shape only"
  - "Add R2_PUBLIC_DOMAIN to both .env and .env.test so app startup validation passes in all environments"

patterns-established:
  - "Profile endpoint pattern: check req.user?.sub, return 401 if missing, call service, return structured JSON response"
  - "Zod schema for partial updates: use .refine() to require at least one field on empty-body rejection"

requirements-completed: [PROF-01, PROF-02, PROF-03, PROF-04, PROF-05]

# Metrics
duration: 9min
completed: 2026-04-01
---

# Phase 02 Plan 01: Profile API Backend Summary

**Profile CRUD API with avatarUrl schema migration, presigned R2 upload URL, and goal creation — 54 integration tests all passing**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-01T10:52:11Z
- **Completed:** 2026-04-01T11:01:11Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Added `avatarUrl` field to User model and applied migration to dev DB
- Implemented PATCH /me, POST /me/avatar-upload-url, POST /me/goals endpoints
- Extended GET /me to return `avatarUrl`, `experienceLevel`, and active `goals` array
- Created 15 integration tests covering happy paths and all error cases (409 conflict, 400 validation, 401 unauthorized)

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration, Zod schemas, env config, and service methods** - `a59f51d` (feat)
2. **Task 2: Controllers, routes, and integration tests** - `9f5d29d` (feat)

**Plan metadata:** (docs commit — to follow)

## Files Created/Modified
- `packages/database/prisma/models/user.prisma` - Added avatarUrl field
- `packages/database/prisma/migrations/20260401105540_add_avatar_url_to_user/migration.sql` - DB migration
- `packages/common/src/validations/user.ts` - updateProfileSchema, upsertGoalSchema, types
- `packages/common/src/index.ts` - Re-exports new schemas
- `apps/api/src/config/env.ts` - Added R2_PUBLIC_DOMAIN validation
- `apps/api/src/services/userService.ts` - Added updateProfile, getAvatarUploadUrl, createGoal; updated getUserByUuid select
- `apps/api/src/controllers/user.ts` - Added updateMyProfile, getAvatarUploadUrl, createMyGoal
- `apps/api/src/routes/user.ts` - Registered three new routes
- `apps/api/tests/integration/helpers/requestSender/usersRequests.ts` - Added patchMyProfile, postAvatarUploadUrl, postMyGoal
- `apps/api/tests/integration/users/updateProfile.test.ts` - 8 test cases for PATCH /me
- `apps/api/tests/integration/users/avatarUpload.test.ts` - 2 test cases for POST /me/avatar-upload-url
- `apps/api/tests/integration/users/goals.test.ts` - 5 test cases for POST /me/goals

## Decisions Made
- Catch P2002 without checking `meta.target`: Prisma 7 with the pg driver adapter omits the `target` array from error metadata. Checking `code === "P2002"` alone is correct because `updateProfile` only performs a `user.update` where `username` is the sole unique constraint.
- Mock `getSignedUrl` in avatar upload test: live R2 credentials are unavailable in test environment; mocking is appropriate to verify response shape without hitting external service.
- Add `R2_PUBLIC_DOMAIN` to `.env`, `.env.test`, and `.env.example`: Zod env validation runs at startup, so the field must exist in all environments or the app won't start.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added R2_PUBLIC_DOMAIN to .env and .env.test**
- **Found during:** Task 1 (env config update)
- **Issue:** Zod validates env vars at startup; without the new variable in env files the API would refuse to start and all tests would fail
- **Fix:** Added `R2_PUBLIC_DOMAIN="pub.example.com"` to `.env`, `.env.test`, and `.env.example`
- **Files modified:** apps/api/.env, apps/api/.env.test, apps/api/.env.example
- **Verification:** `yarn workspace api build` exits 0; tests pass
- **Committed in:** a59f51d (Task 1 commit)

**2. [Rule 1 - Bug] Fixed P2002 error detection in updateProfile**
- **Found during:** Task 2 (test run)
- **Issue:** Test `should reject duplicate username with 409` returned 500. The error catch block checked `meta.target.includes("username")` but Prisma 7 with the pg driver adapter omits `target` from error metadata — `meta` only contains `modelName` and `driverAdapterError`
- **Fix:** Removed `meta.target` check; catching `code === "P2002"` alone is sufficient for this method
- **Files modified:** apps/api/src/services/userService.ts
- **Verification:** All 54 tests pass including duplicate username 409 case
- **Committed in:** 9f5d29d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes required for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
Add `R2_PUBLIC_DOMAIN` to your production environment variables (the public hostname for R2-served files, e.g. `cdn.example.com`). It has been added to `.env.example` as documentation.

## Next Phase Readiness
- All profile API endpoints are working and tested
- Plan 02-02 (native profile screens) can now wire against PATCH /me, GET /me, POST /me/goals
- No blockers

---
*Phase: 02-user-profile*
*Completed: 2026-04-01*

## Self-Check: PASSED
- All created files verified present on disk
- Both task commits (a59f51d, 9f5d29d) verified in git log
