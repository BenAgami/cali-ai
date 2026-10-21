# Codebase Concerns

**Analysis Date:** 2026-10-21

Scope: `apps/api`, `apps/native`, `packages/database`, `packages/common`. Findings are ordered by priority within each section. The architecture changed on 2026-10-21 from video upload to on-device pose with keypoint capture. Section "Video-era leftovers" lists everything from the old design that still exists in code.

## Video-era Leftovers (must migrate)

The keypoint-only design (`POST /api/sessions/:id/capture`, no video, no R2 video) is not yet built. The following video-based artifacts are still present and will mislead the next implementer if left as is.

**`WorkoutSession` video columns and job fields:**
- Issue: `videoDurationSec`, `videoFps`, `videoWidth`, `videoHeight`, `videoSizeBytes`, `videoR2Key`, `bullmqJobId`, `processingStartedAt`, `processingFinishedAt`, `failureReason` are all defined on the model. Only the `processingStatus` and `performedAt` fields are part of the keypoint design.
- Files: `packages/database/prisma/models/workout-session.prisma`, `packages/database/prisma/migrations/20260328144318_add_video_r2_key_and_job_id/migration.sql`
- Impact: Dead columns persist in the schema and in every session response. `STATE.md` already says these need a migration.
- Fix approach: Add a migration that drops `video_*`, `video_r2_key`, and `bullmq_job_id`. Keep `processing_*` and `failure_reason` only if the new state machine uses them. Regenerate with `yarn workspace @repo/db db:generate`.

**Session creation still accepts video metadata:**
- Issue: `videoMetaSchema` is still part of the create-session request. `createSession` writes its fields into the video columns.
- Files: `packages/common/src/validations/workoutSession.ts` (`videoMetaSchema`, `createWorkoutSessionSchema.videoMeta`), `apps/api/src/services/workoutSessionService.ts` (lines 54-59, the `videoDurationSec`…`videoSizeBytes` assignments)
- Impact: Clients can send video-shaped data that the new design should reject. The schema is also shared with `apps/native`, so the change must be coordinated.
- Fix approach: Remove `videoMeta` from `createWorkoutSessionSchema` and from the service `create` payload. The keypoint capture endpoint replaces it.

**Video queue and job contract with no producer or consumer:**
- Issue: `videoAnalysisQueue` (name `"video-analysis"`) is constructed and closed on shutdown, but nothing calls `.add()` and no `Worker` exists anywhere in `apps/api/src`. The job payload type still carries `r2Key`.
- Files: `apps/api/src/lib/queue.ts` (`VideoAnalysisJobData`, `videoAnalysisQueue`), `apps/api/src/lib/shutdown.ts` (line 5 import, line 40 `close()`)
- Impact: The API process opens a Redis connection on boot for no functional purpose. The job type and queue name encode the video design.
- Fix approach: Rename to an analysis queue with a payload of `{ sessionId, ... }` and keypoint references. Add the worker entry point in the same change, since it is the consumer that gives the queue a purpose.

**Constant named for video drives R2 socket sizing:**
- Issue: `VIDEO_ANALYSIS_WORKER_CONCURRENCY` (`apps/api/src/config/constants.ts`) is imported by `apps/api/src/lib/r2.ts` to size the HTTPS agent pool for R2. R2 now serves only avatars.
- Files: `apps/api/src/config/constants.ts`, `apps/api/src/lib/r2.ts`
- Impact: Changing worker concurrency silently changes avatar upload socket limits.
- Fix approach: Give R2 its own socket constant (e.g. `R2_MAX_SOCKETS`) and rename the worker concurrency constant to match its new owner.

**Worker service mode and R2 required at boot:**
- Issue: `SERVICE_NAME` accepts `"worker"` but no worker entry point exists. `R2_*` variables are required by `envSchema` at startup even though R2 is only used for avatars (`apps/api/src/services/userService.ts` `getAvatarUploadUrl`), so the API cannot boot without R2 config.
- Files: `apps/api/src/config/env.ts` (`SERVICE_NAME`, `R2_*`), `apps/api/src/lib/logger.ts` (`base.service`)
- Impact: The planned worker has no declared entry point. Boot is coupled to an unrelated storage provider.
- Fix approach: Add the worker entry (`apps/api/src/worker.ts` or similar) and keep the `"worker"` option only if it is used. Keep R2 vars, since avatars still need them.

**Stale docs and API schema describe video:**
- Issue: `apps/api/src/openapi/schemas.ts` (`WorkoutSessionResponse`, around lines 280-315) documents `videoR2Key`, `bullmqJobId`, and the `video*` fields. `apps/api/.env.example` labels R2 as "video storage" and Redis as the job queue for video. `apps/api/src/controllers/workoutSession.ts` `serializeSession` converts `videoSizeBytes` from `BigInt`.
- Files: as listed.
- Impact: The OpenAPI contract publishes internal and obsolete fields.
- Fix approach: Update the schema and env example in the same change as the migration. Serialize sessions through an explicit response schema (see Security, "Internal fields in session responses").

**Processing state machine never advances:**
- Issue: `createSession` sets `processingStatus: PENDING`. No code path moves it to PROCESSING, COMPLETED, or FAILED. No 10-minute stuck-job reaper exists. `processingStartedAt`, `processingFinishedAt`, and `failureReason` are never written.
- Files: `apps/api/src/services/workoutSessionService.ts`, `packages/database/prisma/models/workout-session.prisma`
- Impact: Every session stays PENDING forever. This is the Phase 1 requirement in `.planning/ROADMAP.md`, not yet built.
- Fix approach: Implement transitions in the worker, plus a reaper that fails PROCESSING rows older than 10 minutes. The `idx_sessions_processing_status` index already covers the reaper query.

**Native app has no session wiring:**
- Issue: No file under `apps/native` calls `/workout-sessions`. `react-native-vision-camera` and `react-native-fast-tflite` are declared in `apps/native/package.json` and `apps/native/app.json` plugins, but no source file imports them.
- Files: `apps/native/package.json`, `apps/native/app.json`, `apps/native/metro.config.js`
- Impact: Expected for the Phase 1 dev-build gate, but the deps are unused in JS until Phase 5. Confirm `yarn knip` passes with them.
- Fix approach: None needed now. Revisit when the camera feature lands.

## Tech Debt

**Logging rule violations:**
- Issue: `console.log` used on disconnect, `console.error` in env validation.
- Files: `packages/database/src/prisma.ts` (lines 34 and 37, `console.log("Prisma disconnected")`), `apps/api/src/config/env.ts` (lines 41-42, `console.error`)
- Impact: Violates the project logging rule. Output bypasses pino's structured fields.
- Fix approach: Log the disconnect through the API logger, or move the message to the caller in `apps/api/src/lib/shutdown.ts`. In `env.ts`, `console.error` is justified only because the logger depends on env; keep it but document the exception, or emit the error before the logger is imported.

**Shared `authorize` middleware is unused:**
- Issue: `apps/api/src/middlewares/auth/authorization.ts` is exported and marked "not yet mounted". The exercise listing re-implements the same check inline.
- Files: `apps/api/src/middlewares/auth/authorization.ts`, `apps/api/src/middlewares/auth/index.ts`, `apps/api/src/controllers/exercise.ts` (lines 27-31)
- Impact: Two role checks that can drift apart. The `@public` tag keeps knip green.
- Fix approach: Use `authorize(Role.ADMIN)` in the `includeInactive` path (route level), or delete the middleware until a route needs it.

**Duplicate exercise lookup:**
- Issue: `WorkoutSessionService.getExerciseByCode` duplicates `exerciseService.getExerciseByCode` with a narrower `select`.
- Files: `apps/api/src/services/workoutSessionService.ts`, `apps/api/src/services/exerciseService.ts`
- Impact: Divergence risk on the `isActive` rule (see Security, inactive exercises).
- Fix approach: Share one helper that takes `select`.

**Extra user lookup on every service call:**
- Issue: Services call `getUserIdByUuid` before each query, although the JWT already carries the user's uuid.
- Files: `apps/api/src/services/workoutService.ts`, `apps/api/src/services/workoutSessionService.ts`, `apps/api/src/utils/getUserIdByUuid.ts`
- Impact: One extra round trip per request.
- Fix approach: Resolve the internal id once per request in middleware and store it on `req`, or join on uuid in the query.

**Username generation is check-then-insert:**
- Issue: `AuthService.generateUniqueUsername` (`apps/api/src/services/authService.ts`) checks existence then creates later in `register`. The 4-digit suffix has 10,000 values.
- Files: `apps/api/src/services/authService.ts`
- Impact: A race can produce a unique-constraint failure. The catch in `register` only maps P2002 to 409 when `meta.target` is an array containing `username`. The Phase 02 decision in `.planning/STATE.md` notes that Prisma 7 with the pg adapter omits `meta.target`, so that collision likely surfaces as a 500.
- Fix approach: Map P2002 on the username path without requiring `meta.target` (the code check alone is enough; see `prismaErrorCodes.ts`). Retry on collision.

**Stale planning state:**
- Issue: `.planning/STATE.md` says the token is stored in AsyncStorage under `@cali_auth_token`. The code stores tokens in SecureStore (`apps/native/src/api/tokenStore.ts`, keys `cali_access_token` and `cali_refresh_token`).
- Files: `.planning/STATE.md`, `apps/native/src/api/tokenStore.ts`
- Impact: Misleads future planning.
- Fix approach: Update STATE.md when the auth decision is revisited (per the project's planning-doc rule).

## Known Bugs

**Parallel 401s cause forced logout (refresh-token reuse):**
- Symptoms: When several requests get 401 at once, the user is logged out.
- Files: `apps/native/src/api/client.ts` (`tryRefreshAndRetry`, `request`), `apps/api/src/services/refreshTokenService.ts` (`rotateRefreshToken`)
- Trigger: Each failed request reads the stored refresh token and calls `/api/auth/refresh`. The first call rotates the token. The second call presents the already-revoked token, which the service treats as reuse and revokes the entire family (`updateMany` on `familyId`). Both requests then fail and `clearTokens()` runs.
- Workaround: None in client. Users must log in again.
- Fix approach: Make refresh single-flight in the client (store one in-flight promise, share it across callers, and re-read the stored token after the await). Keep reuse detection on the server.

**Refresh rotation is not atomic:**
- Symptoms: Two concurrent refreshes with the same token can both succeed.
- Files: `apps/api/src/services/refreshTokenService.ts` (`rotateRefreshToken`: `findUnique` → `update` → `createRefreshToken`)
- Trigger: Two requests land before the first `update` commits.
- Workaround: None.
- Fix approach: Use a conditional update (`updateMany` where `id` and `revokedAt: null`, then check `count === 1`) inside a transaction before issuing the new token. Add an integration test for concurrent refresh.

## Security Considerations

**Stack traces returned to clients when `NODE_ENV` is unset:**
- Risk: `NODE_ENV` defaults to `"development"`. `errorHandler` includes `details: error.stack` whenever `NODE_ENV !== "production"`.
- Files: `apps/api/src/config/env.ts` (`NODE_ENV` default), `apps/api/src/middlewares/errorHandler.ts`
- Current mitigation: None in code. `apps/api` `start` script does not set `NODE_ENV`, so correctness depends on the deployment environment.
- Recommendations: Default `NODE_ENV` to `"production"` (or require it). Gate `details` on an explicit `EXPOSE_ERROR_DETAILS` flag.

**OpenAPI docs and debug output enabled by default:**
- Risk: `/api` OpenAPI routes mount whenever `NODE_ENV !== "production"` (`apps/api/src/routes/index.ts`). The `pino-pretty` transport is used in development (`apps/api/src/lib/logger.ts`). `pino-pretty` is a devDependency, so a container that does not set `NODE_ENV` would try to load a missing transport.
- Files: `apps/api/src/routes/index.ts`, `apps/api/src/lib/logger.ts`, `apps/api/package.json`
- Current mitigation: `dev` script sets `NODE_ENV=development`.
- Recommendations: Same fix as above. Fail boot when `NODE_ENV` is missing in a deployed image.

**No `trust proxy`; rate limiter shares one bucket behind a proxy:**
- Risk: `express-rate-limit` keys by `req.ip`. Behind a load balancer every client shares the proxy IP, so 10 login or register attempts in 15 minutes locks out everyone.
- Files: `apps/api/src/app.ts` (no `app.set("trust proxy", ...)`), `apps/api/src/middlewares/authRateLimiter.ts`
- Current mitigation: None. The limiter is skipped entirely when `NODE_ENV=test`.
- Recommendations: Set `trust proxy` to the deployed hop count. Back the limiter with a Redis store so limits hold across instances.

**Rate limiter gaps:**
- Risk: `/api/auth/refresh` and `/api/auth/logout` have no limiter (`apps/api/src/routes/auth.ts`). The limiter store is in-memory per process.
- Recommendations: Add the limiter to refresh. Use a shared store.

**User enumeration on login and register:**
- Risk: `AuthService.login` returns before `bcrypt.compare` when the email is unknown, so response time reveals account existence. `register` returns 409 "User with this email already exists".
- Files: `apps/api/src/services/authService.ts` (`login`, `register`)
- Current mitigation: Login message is generic for wrong password.
- Recommendations: Run a dummy bcrypt compare for unknown users. Consider a generic response on register.

**Any authenticated user can read any user's email and role:**
- Risk: `GET /api/users/:uuid` returns `email` and `role` for any user.
- Files: `apps/api/src/routes/user.ts`, `apps/api/src/controllers/user.ts` (`getUserProfile`), `apps/api/src/services/userService.ts` (`getUserByUuid` selects `email` and `role`), `packages/common/src/validations/user.ts` (`userProfileSchema` includes `email`)
- Current mitigation: Authentication is required.
- Recommendations: Return only public fields for other users. Keep `email` and `role` for `/me`.

**Inactive exercises visible to any authenticated user:**
- Risk: `getExerciseByCode` is called with `!!req.user`, so any logged-in user can fetch inactive exercises by code. The existing test pins this behaviour.
- Files: `apps/api/src/controllers/exercise.ts`, `apps/api/src/services/exerciseService.ts`, `apps/api/tests/unit/controllers/exercise.test.ts`
- Current mitigation: `includeInactive` on the list endpoint requires ADMIN.
- Recommendations: Require ADMIN for inactive lookups, consistent with the list path. Update the pinned test.

**Access tokens survive logout and role changes:**
- Risk: The JWT carries `role` and is verified statelessly. `POST /api/auth/logout` revokes only the refresh token. An access token stays valid for `JWT_EXPIRES_IN` (default 15m), and a role change takes effect only after re-login.
- Files: `apps/api/src/middlewares/auth/authentication.ts`, `apps/api/src/utils/generateJwtToken.ts`, `apps/api/src/services/refreshTokenService.ts` (`revokeToken`)
- Current mitigation: Short access-token lifetime.
- Recommendations: Keep the short lifetime. Re-read role from the database for admin-only checks, or accept the window and document it.

**Avatar upload has no size bound and the stored URL is unrestricted:**
- Risk: The presigned PUT (`apps/api/src/services/userService.ts` `getAvatarUploadUrl`) pins only `ContentType` and not `ContentLength`. `updateProfileSchema` (`packages/common/src/validations/user.ts`) accepts any `z.url()` for `avatarUrl`, not only the R2 public domain.
- Current mitigation: 300-second URL expiry.
- Recommendations: Add a content-length condition to the presign. Restrict `avatarUrl` to `R2_PUBLIC_DOMAIN` (or to keys the user was issued).

**Password policy applied at login:**
- Risk: `loginSchema` reuses `strongPasswordSchema` (`packages/common/src/validations/auth.ts`). Tightening the policy locks out existing users. There is no maximum length, and bcrypt only uses the first 72 bytes, so long passwords are silently truncated.
- Recommendations: Use a minimal length check at login. Add `.max(72)` to the password schema.

**Refresh tokens and logout race:**
- Risk: See Known Bugs. Logout revokes one token, not the family.
- Recommendations: Revoke the family on logout when the caller presents a valid refresh token.

**Internal fields in session responses:**
- Risk: `createSession` returns the full Prisma row via `serializeSession(session)` (`apps/api/src/controllers/workoutSession.ts`), which includes `userId`, `bullmqJobId`, and `videoR2Key`.
- Recommendations: Return an explicit response shape from a shared schema in `packages/common`, per the project's response-shape rule.

**Global 10 MB JSON body limit:**
- Risk: `express.json({ limit: "10mb" })` in `apps/api/src/app.ts` applies to every route. Keypoint payloads are ~25-60 KB.
- Recommendations: Keep a small global limit (e.g. 1 MB) and raise it per route only for the capture endpoint.

## Performance Bottlenecks

**Health check ignores Redis:**
- Problem: `GET /api/health` checks only Postgres (`apps/api/src/routes/health.ts`). Redis is connected at import time in `apps/api/src/lib/redis.ts` with `maxRetriesPerRequest: null`, so queue operations hang while Redis is down instead of failing.
- Files: `apps/api/src/routes/health.ts`, `apps/api/src/lib/redis.ts`, `apps/api/src/lib/queue.ts`
- Cause: No readiness check for Redis; infinite retry on request paths once a job is enqueued.
- Improvement path: Add a Redis ping to health. Add a timeout to enqueue calls so the capture endpoint can return 503.

**bcrypt on every auth request:**
- Problem: Login and register run bcrypt at 10 rounds on the libuv threadpool (default size 4).
- Files: `apps/api/src/services/authService.ts` (`BCRYPT_ROUNDS = 10`)
- Cause: Synchronous CPU work shares the default threadpool with DNS and file I/O.
- Improvement path: Raise `UV_THREADPOOL_SIZE` in deployment, and let the rate limiter bound login volume.

## Fragile Areas

**Import-time side effects in `lib/`:**
- Files: `apps/api/src/lib/redis.ts`, `apps/api/src/lib/queue.ts`, `apps/api/src/lib/r2.ts`, `apps/api/src/config/env.ts`
- Why fragile: Constructing `IORedis`, `Queue`, and `S3Client` at import time means any module that imports `shutdown.ts` or `userService.ts` opens connections and reads env. Unit tests must mock these modules.
- Safe modification: Keep new clients behind lazy getters, following the `private get prisma()` pattern.
- Test coverage: `apps/api/tests/unit/lib/shutdown.test.ts` exists; there is no test for `lib/redis.ts`.

**Prisma singleton with module-level state:**
- Files: `packages/database/src/prisma.ts`
- Why fragile: `connectPrisma` caches on `global` only outside production, and `getPrismaClient` throws until connected. A second `connectPrisma` in production creates a second client.
- Safe modification: Call `connectPrisma` once from `apps/api/src/index.ts` only.

**Stale closure in rest-timer effect:**
- Files: `apps/native/src/hooks/useWorkoutExecution.ts` (line 54 `eslint-disable-next-line react-hooks/exhaustive-deps`)
- Why fragile: `advanceAfterRest` is omitted from the dependency array, so the effect can call a stale callback.
- Safe modification: Include `advanceAfterRest` in deps (wrap state updates with functional setters) and remove the disable comment.

**Native client throws at module load:**
- Files: `apps/native/src/api/client.ts` (line 7)
- Why fragile: Missing `EXPO_PUBLIC_API_BASE_URL` crashes the bundle rather than showing an error screen.
- Safe modification: Keep the check, but ensure `.env` is documented in `apps/native`.

## Scaling Limits

**Rate limiter state:**
- Current capacity: 10 auth requests per IP per 15 minutes, held in process memory.
- Limit: Each API instance keeps its own counter, so effective limits multiply with instance count.
- Scaling path: Redis-backed store for `express-rate-limit`.

**Analysis pipeline (not built):**
- Current capacity: No worker, no reaper, no SSE. `VIDEO_ANALYSIS_WORKER_CONCURRENCY = 5` is a placeholder.
- Limit: Once built, a single worker process with concurrency 5 will be the only throughput path.
- Scaling path: Separate worker process (`SERVICE_NAME=worker`), concurrency tuned against LLM rate limits.

## Dependencies at Risk

**`bcrypt` native module:**
- Risk: Native addon; builds fail on some platforms and Node versions.
- Files: `apps/api/package.json` (`bcrypt ^5.1.1`)
- Impact: Deploy and CI build failures.
- Migration plan: Consider `bcryptjs` (pure JS, same hash format) if native build issues appear.

**`react-native-vision-camera` and `react-native-fast-tflite`:**
- Risk: Custom native modules that require an EAS dev build. Not yet exercised in JS.
- Files: `apps/native/package.json`
- Impact: Build breakage blocks the Phase 1 gate.
- Migration plan: Keep them pinned; validate on both simulators as the roadmap requires.

## Missing Critical Features

**Keypoint capture endpoint:**
- Problem: `POST /api/sessions/:id/capture` does not exist. Nothing produces analysis results (`AnalysisResult` rows are only read in `listSessions`).
- Blocks: FORM-03, INFRA-02, the SSE status stream, and the training-data consent flow (DATA-02).

**Consent flag:**
- Problem: No field records training-data consent on user or session. DATA-02 requires it before keypoints are kept.
- Blocks: Any keypoint storage.

## Test Coverage Gaps

**Auth rate limiter:**
- What's not tested: `authRateLimiter` is skipped when `NODE_ENV=test`, so no test verifies the 429 path.
- Files: `apps/api/src/middlewares/authRateLimiter.ts`
- Risk: Limit or proxy misconfiguration ships unnoticed.
- Priority: High

**Concurrent refresh rotation:**
- What's not tested: No integration test issues two refreshes with the same token simultaneously.
- Files: `apps/api/src/services/refreshTokenService.ts`, `apps/api/tests/integration/auth/refresh.test.ts`
- Risk: Reuse detection can revoke a family on legitimate retries (see Known Bugs).
- Priority: High

**Native app:**
- What's not tested: `apps/native` has no test files. The API client's refresh path, token storage, and hooks are untested.
- Files: `apps/native/src/api/client.ts`, `apps/native/src/api/tokenStore.ts`
- Risk: The forced-logout bug went unnoticed.
- Priority: High

**Controllers without unit tests:**
- What's not tested: Only `controllers/exercise.ts` and `controllers/workoutSession.ts` have unit tests. `controllers/auth.ts`, `controllers/user.ts`, and `controllers/workout.ts` are covered only by integration tests.
- Files: `apps/api/tests/unit/controllers/`
- Risk: Error-mapping branches go unexercised.
- Priority: Medium

**Authorization middleware:**
- What's not tested: `apps/api/src/middlewares/auth/authorization.ts` has a unit test file but no route uses it. The `includeInactive` admin check has no test for a non-admin with a valid token.
- Files: `apps/api/tests/unit/middlewares/auth/authorization.test.ts`, `apps/api/src/controllers/exercise.ts`
- Risk: Admin gate regressions.
- Priority: Medium

**Avatar upload size and URL validation:**
- What's not tested: `apps/api/tests/integration/users/avatarUpload.test.ts` mocks `getSignedUrl`, so the presigned conditions are not checked. No test covers an arbitrary `avatarUrl`.
- Priority: Medium

---

*Concerns audit: 2026-10-21*
