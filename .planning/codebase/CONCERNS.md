# Codebase Concerns

**Analysis Date:** 2026-03-21

## Tech Debt

**Error handler uses `any` type and is marked for enhancement:**
- Issue: `errorHandler.ts` typed its `error` parameter as `any` and carries a `// TODO: Enhanced Error Handling` comment. It uses raw `console.error`, exposes no error codes in the response body, and does nothing different for production vs development (stack traces could leak in prod).
- Files: `apps/api/src/middlewares/errorHandler.ts`
- Impact: Clients receive only a status code and message string with no machine-readable error code. Error payloads are inconsistent across the API (Zod errors include `details`, all other errors do not).
- Fix approach: Add a structured `{ success, message, code, details? }` shape for all errors; gate stack trace logging to non-production environments; replace `any` with `unknown` and narrow explicitly.

**Health check is a bare stub:**
- Issue: `GET /api/health` always returns `{ status: "ok" }` with a `// TODO: Enhanced Health Checks (Readiness Checks)` comment. There is no database connectivity probe or dependency liveness check.
- Files: `apps/api/src/routes/health.ts`
- Impact: Deployment orchestrators (Kubernetes, ECS) that rely on readiness probes will report the service healthy even when the database is unreachable. A crashed Prisma connection would not be detected until an actual request fails.
- Fix approach: Query `prisma.$queryRaw\`SELECT 1\`` inside the health handler and return 503 if it throws.

**`asyncWrapper` typed with `Function`:**
- Issue: `asyncHandler` accepts its parameter as the bare `Function` type instead of the typed Express handler signature.
- Files: `apps/api/src/utils/asyncWrapper.ts`
- Impact: TypeScript will not catch mismatched handler signatures at compile time. A handler with a wrong signature will silently compile and fail at runtime.
- Fix approach: Type the parameter as `(req: Request, res: Response, next: NextFunction) => Promise<unknown>`.

**Dual `status` / `statusCode` on `ApiError`:**
- Issue: `ApiError` stores the HTTP status in two redundant properties (`status` and `statusCode`) with an assignment trick (`this.status = this.statusCode = status`). The error handler reads `error.status`, making `statusCode` unused dead code.
- Files: `apps/api/src/errors/ApiError.ts`, `apps/api/src/middlewares/errorHandler.ts`
- Impact: Confusing to maintain; any future consumer that reads `statusCode` will get the correct value by accident rather than design.
- Fix approach: Remove the `statusCode` property or alias it via a getter.

**Username generation uses non-atomic retry loop:**
- Issue: `generateUniqueUsername` in `UserService` executes up to 10 sequential `findUnique` queries to probe for an available username, then relies on a Prisma `P2002` unique constraint fallback if all 10 checks are exhausted in a race. Each check is a separate round-trip to the database.
- Files: `apps/api/src/services/userService.ts`
- Impact: Under concurrent registrations with the same email prefix, the non-atomic check-then-insert pattern can still cause duplicate username collisions not caught by the retry loop, falling through to a thrown `ConflictError` that leaks the username collision detail to the user.
- Fix approach: Use a DB-generated sequence or a UUID suffix for usernames, or use an `INSERT ... ON CONFLICT` (upsert) pattern so uniqueness is enforced atomically.

**`catch (error: any)` in `userService.register`:**
- Issue: The Prisma error catch block casts `error` to `any` to access `error.code` and `error.meta`. This is fragile against Prisma version changes that alter internal error shapes.
- Files: `apps/api/src/services/userService.ts`
- Impact: If Prisma changes its error shape, the check silently fails and the raw Prisma error propagates to the client.
- Fix approach: Import and use `Prisma.PrismaClientKnownRequestError` and narrow with `instanceof`.

---

## Security Considerations

**CORS configured to accept all origins:**
- Risk: `cors({ origin: true, credentials: true })` reflects any incoming `Origin` header and allows credentials. This effectively disables CORS protection and permits any web page to make authenticated requests to the API.
- Files: `apps/api/src/app.ts`
- Current mitigation: None beyond JWT requirement on protected routes.
- Recommendations: Set `origin` to an explicit allowlist (e.g., `['https://app.example.com']`) before any public deployment. Never use `origin: true` with `credentials: true` in production.

**No rate limiting on authentication endpoints:**
- Risk: `POST /api/users/login` and `POST /api/users/register` have no request rate limiting. Brute-force attacks against passwords and credential enumeration via timing differences are unrestricted.
- Files: `apps/api/src/routes/user.ts`, `apps/api/src/app.ts`
- Current mitigation: None.
- Recommendations: Apply `express-rate-limit` or similar on auth routes before production deployment.

**No token revocation / refresh token mechanism:**
- Risk: Issued JWTs are valid until expiry (`JWT_EXPIRES_IN`, defaulting to `"1h"`). There is no refresh token flow and no revocation list. A stolen token cannot be invalidated before it expires.
- Files: `apps/api/src/utils/generateJwtToken.ts`, `apps/api/src/middlewares/authentication.ts`
- Current mitigation: Short default expiry (`1h`).
- Recommendations: Implement a refresh token stored in an HTTP-only cookie and a token revocation mechanism (e.g., Redis blocklist) before production.

**`GET /api/users/:uuid` is unauthenticated:**
- Risk: Any caller can enumerate any user's profile (email, full name, role, username) by probing UUIDs. The route applies `validateSchema` but no `authenticateToken` middleware.
- Files: `apps/api/src/routes/user.ts`
- Current mitigation: UUIDv7 space is large, making random guessing slow but not impossible if UUIDs are ever leaked.
- Recommendations: Add `authenticateToken` to `GET /:uuid` and decide whether non-admin users should be allowed to fetch other users' profiles. Consider returning a reduced public profile shape.

**`includeInactive` exercises flag is unauthenticated and unguarded:**
- Risk: `GET /api/exercises?includeInactive=true` exposes inactive (unpublished) exercises to any unauthenticated caller.
- Files: `apps/api/src/controllers/exercise.ts`, `apps/api/src/routes/exercise.ts`
- Current mitigation: None.
- Recommendations: Gate `includeInactive=true` behind the `authorize(Role.ADMIN)` middleware.

**`morgan("dev")` is active in production build:**
- Risk: `morgan("dev")` is applied unconditionally in `createApp()`. The `dev` format logs full request URLs and response times to stdout in production, potentially leaking sensitive path parameters.
- Files: `apps/api/src/app.ts`
- Current mitigation: None.
- Recommendations: Switch to `morgan("combined")` for non-development environments, or gate it: `if (env.runtimeEnv !== 'production')`.

---

## Missing Critical Features

**AI service integration does not exist:**
- Problem: The architecture doc describes a Backend → AI Service HTTP call for video analysis, but there is no AI service client, no video upload handler, no multipart parsing, no `multer` dependency, and no code for transitioning a `WorkoutSession` from `PENDING` to `PROCESSING`/`COMPLETED`/`FAILED`. The `processingStatus` field is always `PENDING` after session creation.
- Blocks: The core product feature (form analysis feedback) cannot function. Sessions are created but never analyzed.

**Native app auth screens have no API integration:**
- Problem: Both `login.tsx` and `register.tsx` in `apps/native` contain `handleSignIn` and `handleSignUp` handlers that only call `console.log` with stub comments. No API calls are made.
- Files: `apps/native/app/(auth)/login.tsx`, `apps/native/app/(auth)/register.tsx`
- Blocks: The mobile app cannot authenticate users.

**Google Sign-In button is a non-functional placeholder:**
- Problem: `GoogleSignInButton` renders and accepts an `onPress` prop, but both `handleGoogleSignIn` implementations in login and register screens only call `console.log`. There is no OAuth flow, no backend OAuth endpoint, and no expo-auth-session integration.
- Files: `apps/native/app/(auth)/login.tsx`, `apps/native/app/(auth)/register.tsx`, `packages/ui/src/auth/GoogleSignInButton.tsx`
- Blocks: Social sign-in cannot work.

**`Remember Me` toggle has no effect:**
- Problem: The `rememberMe` state in the login screen is passed to `console.log` only. There is no persistent token storage (AsyncStorage, SecureStore) wired to this toggle.
- Files: `apps/native/app/(auth)/login.tsx`

**No video upload endpoint:**
- Problem: The `WorkoutSession` schema stores video metadata fields (`videoDurationSec`, `videoFps`, `videoWidth`, `videoHeight`, `videoSizeBytes`) but there is no `POST /api/sessions/:id/video` or equivalent endpoint to receive or process an actual video file.
- Files: `apps/api/src/routes/session.ts`, `apps/api/src/services/workoutSessionService.ts`
- Blocks: The primary data-collection path (video → analysis) is incomplete.

**Milestone and body metric APIs do not exist:**
- Problem: The database schema has fully defined `milestone_definitions`, `user_milestones`, `body_metrics`, and `user_goals` tables with indexes, but there are zero API routes, controllers, or services for these entities.
- Files: `apps/api/src/routes/` (no milestone, body metric, or goal route files)
- Blocks: Progress tracking and milestone features are inaccessible.

---

## Fragile Areas

**Test isolation relies on full table wipe per test suite:**
- Files: `apps/api/tests/integration/helpers/testSetup.ts`
- Why fragile: `teardownIntegrationTest` deletes all rows in explicit dependency order across every table. If a new table is added without updating this list, its rows will accumulate across test runs and can cause false passes or false failures due to stale data.
- Safe modification: Add each new Prisma model to the `cleanupDatabase` deletion list in the correct cascade order, or switch to Prisma migrations with a `--reset` in `globalSetup.ts` (which already exists).

**`getPrismaClient()` will throw if called before `connectPrisma()`:**
- Files: `packages/database/src/prisma.ts`
- Why fragile: Services call `getPrismaClient()` via a getter on every method invocation. If any service method is called before the server's `startServer()` function awaits `connectPrisma()`, the error surfaces as an uncaught throw inside a request handler, bypassing `asyncHandler`.
- Safe modification: Ensure `connectPrisma` is always awaited before `createApp` is called in both production (`apps/api/src/index.ts`) and test (`testSetup.ts`).

**`videoSizeBytes` BigInt serialization is manual:**
- Files: `apps/api/src/controllers/workoutSession.ts`
- Why fragile: `JSON.stringify` cannot serialize `BigInt` natively. The `serializeSession` helper manually converts `videoSizeBytes` to `Number`. As more BigInt fields are potentially added, each one must be individually handled. `Number(BigInt)` also silently loses precision for values above `Number.MAX_SAFE_INTEGER`.
- Safe modification: Add a global Express JSON replacer or a Prisma response transformer that converts all `BigInt` fields to strings.

---

## Performance Bottlenecks

**`listSessions` joins exercise via relation filter without direct index:**
- Problem: When filtering by `exerciseCode`, `workoutSessionService.listSessions` uses a nested relation filter `{ exercise: { code: normalizedExerciseCode } }`. Prisma translates this to a JOIN or subquery against the `exercises` table, then applies the composite index `idx_sessions_user_exercise_performed_at_desc` on `(user_id, exercise_id, performed_at)`. The filter traverses by code string rather than by pre-resolved `exercise_id`.
- Files: `apps/api/src/services/workoutSessionService.ts`
- Improvement path: Resolve `exercise_id` by code first (as done in `createSession`), then filter `WHERE user_id = ? AND exercise_id = ?` to hit the composite index directly.

**Username uniqueness probe is N sequential DB queries:**
- Problem: `generateUniqueUsername` can issue up to 10 sequential `findUnique` queries before succeeding or giving up.
- Files: `apps/api/src/services/userService.ts`
- Improvement path: Append a UUID or timestamp suffix instead of random digits; use a DB sequence; or use `INSERT ... ON CONFLICT DO UPDATE` to generate a username in a single query.

---

## Test Coverage Gaps

**No unit tests anywhere:**
- What's not tested: Service-layer logic (username generation collision path, email normalization, Prisma error wrapping), middleware logic (authorization role checks), utility functions (`generateJwtToken`, `zodErrorMessage`).
- Risk: Edge cases in business logic change silently without failing tests.
- Priority: Medium — integration tests cover the happy paths, but internal branching and error normalization are uncovered.

**`GET /api/users/:uuid` has no auth coverage:**
- What's not tested: The route returns 200 to any unauthenticated caller. There is no test confirming or denying this behavior.
- Files: `apps/api/tests/integration/users/getUserByUuid.test.ts`
- Priority: High.

**`includeInactive` parameter on exercises is not tested:**
- What's not tested: No test asserts that inactive exercises are hidden from unauthenticated callers, nor that they are visible when `includeInactive=true` is passed.
- Files: `apps/api/tests/integration/exercises/listExercises.test.ts`
- Priority: Medium.

**Session listing `exerciseCode` filter edge cases not tested:**
- What's not tested: Filtering by an exercise code that belongs to a different user's session; filtering with an inactive code; pagination combined with filter.
- Files: `apps/api/tests/integration/sessions/listSessions.test.ts`
- Risk: Cross-user data leakage in filtered list views.
- Priority: High.

**Native app has zero tests:**
- What's not tested: All React Native screens and components in `apps/native/`.
- Priority: Low (pre-integration, no backend calls wired yet).

---

## Dependencies at Risk

**Yarn Classic (v1.22.19) is end-of-life:**
- Risk: Yarn 1.x is no longer receiving security updates. The monorepo is locked to it via `packageManager: "yarn@1.22.19"`.
- Impact: Potential unpatched vulnerabilities in the package resolution chain; incompatibility with future workspace tooling.
- Migration plan: Migrate to Yarn Berry (v4) or switch to `pnpm` which has first-class Turborepo support.

**`@prisma/adapter-pg` requires explicit Postgres driver management:**
- Risk: The driver adapter pattern (`PrismaPg`) is relatively new and requires careful connection string and pool management. Both the seed script and the prisma client init re-create the adapter manually, with no pooling configuration.
- Files: `packages/database/src/prisma.ts`, `packages/database/prisma/seed.ts`
- Impact: Under concurrent load, the default `pg` connection defaults may be too low (default max pool: 10). No pool sizing is configured anywhere.
- Migration plan: Add explicit `max`, `idleTimeoutMillis`, and `connectionTimeoutMillis` parameters to `PrismaPg` initialization.

---

*Concerns audit: 2026-03-21*
