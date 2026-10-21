# Architecture

**Analysis Date:** 2026-10-21

## Pattern Overview

**Overall:** Layered modular monolith (Express REST API) inside a Turborepo monorepo, with a React Native (Expo) client. The API is three-tier: route → controller → service → Prisma. The async analysis pipeline described in `docs/architecture.md` is **not yet implemented** (see "Implemented vs Planned" below).

**Key Characteristics:**
- Strict three-tier server flow; controllers never touch Prisma and services never touch `req`/`res`.
- Services are exported as singletons (`export default new XService()`) and read Prisma through a lazy `private get prisma()` getter that calls `getPrismaClient()`.
- Request validation happens in middleware (`validateSchema`) using Zod schemas that live in `packages/common` and are shared with the native app.
- Errors are typed (`apps/api/src/errors/`) and funnelled into a single Express error handler.
- Pure shared contracts (Zod schemas, types) live in `packages/common` and are consumed by both `apps/api` and `apps/native`.
- Server state on the client is managed with TanStack Query; auth state with a React context plus a `SecureStore`-backed token store.

## Implemented vs Planned

Describe the current code, not the target design. The planned on-device pose pipeline is documented in `docs/architecture.md` and `.planning/ROADMAP.md` (Phase 1 and Phase 5).

**Implemented:**
- Auth (register, login, refresh, logout) with JWT access tokens and DB-backed refresh tokens (`apps/api/src/services/authService.ts`, `apps/api/src/services/refreshTokenService.ts`).
- Users/profile, avatar upload URL via Cloudflare R2 presigned PUT (`apps/api/src/services/userService.ts`, `apps/api/src/lib/r2.ts`).
- Exercise catalog (`apps/api/src/services/exerciseService.ts`).
- Manual workouts: CRUD plus `startWorkout` which writes a `WorkoutLog` (`apps/api/src/services/workoutService.ts`).
- Workout sessions: `POST /api/workout-sessions` and `GET /api/workout-sessions`. Sessions are created with `processingStatus = PENDING` and nothing transitions them afterwards (`apps/api/src/services/workoutSessionService.ts`).
- Health check (`apps/api/src/routes/health.ts`) and OpenAPI/Scalar docs in non-production (`apps/api/src/routes/openapi.ts`).

**Partially implemented (scaffolding only, no producer or consumer):**
- BullMQ queue `video-analysis` is constructed in `apps/api/src/lib/queue.ts` with a `VideoAnalysisJobData = { sessionId, r2Key }` payload. Nothing enqueues to it. It is imported only by `apps/api/src/lib/shutdown.ts` to close it on exit.
- Redis connection `apps/api/src/lib/redis.ts` (`maxRetriesPerRequest: null`) is created on import and closed on shutdown.
- `SERVICE_NAME` env accepts `"worker"` (`apps/api/src/config/env.ts`), and `VIDEO_ANALYSIS_WORKER_CONCURRENCY` is set in `apps/api/src/config/constants.ts`, but there is no worker entry point in the repo. `apps/api/src/index.ts` is the only entry point and it starts only the HTTP server.
- Session columns for the earlier video design (`videoDurationSec`, `videoFps`, `videoWidth`, `videoHeight`, `videoSizeBytes`, `videoR2Key`, `bullmqJobId`, `processingStartedAt`, `processingFinishedAt`, `failureReason`) exist in `packages/database/prisma/models/workout-session.prisma` and `videoMeta` is still accepted by `createWorkoutSessionSchema` in `packages/common/src/validations/workoutSession.ts`. This is legacy from the video-upload design and is superseded by keypoint capture.
- `AnalysisResult`, `AnalysisFinding` models exist (`packages/database/prisma/models/analysis-result.prisma`, `analysis-finding.prisma`) but no code writes them.
- `authorize` role guard (`apps/api/src/middlewares/auth/authorization.ts`) is exported but not mounted on any route.
- `apps/native` depends on `react-native-vision-camera` and `react-native-fast-tflite` (`apps/native/package.json`), but no source file under `apps/native/app` or `apps/native/src` imports them.

**Planned, not present in code:**
- `POST /api/sessions/:id/capture` (keypoint capture, 202 + job ID).
- `GET /api/sessions/:id/status` (SSE progress stream).
- Worker process (BullMQ consumer) doing metrics, LLM call and result storage.
- `PoseCapture`, `FormLabel` and consent models (no Prisma model files for them).
- Shared analysis/exercise-definition code in `@repo/common` (no such module yet; `packages/common/src/` contains only validations and constants).
- Stuck-`PROCESSING` sweeper (10-minute auto-fail).
- Client camera/pose modules and the analysis screen.

Note on route paths: the live mount is `/api/workout-sessions`. The JSDoc in `apps/api/src/controllers/workoutSession.ts` says `/api/sessions`, and the docs say `/api/sessions/:id/...`. Treat the JSDoc and the docs as stale; the router is authoritative.

## Layers

**Entry / bootstrap (`apps/api/src/index.ts`, `apps/api/src/app.ts`):**
- Purpose: Connect Prisma, build the Express app, listen, register graceful shutdown.
- Location: `apps/api/src/index.ts`, `apps/api/src/app.ts`
- Contains: Middleware stack (helmet, cors, JSON body limit 10mb, pino-http), `/api` mount, 404 fallback, error handler.
- Depends on: `@repo/db` (`connectPrisma`), `config/env`, `lib/logger`, `lib/shutdown`, `routes`.
- Used by: Node process start (`tsx` in dev, `node dist/index.js` in prod).

**Routing (`apps/api/src/routes/`):**
- Purpose: Map HTTP method + path to middleware chain and controller.
- Location: `apps/api/src/routes/*.ts`, aggregated in `apps/api/src/routes/index.ts`.
- Contains: `Router()` instances; each route chains `authenticateToken` (where needed), `validateSchema(z.object({ body|query|params: schema }))`, then a controller.
- Depends on: `middlewares/`, `controllers/`, `@repo/common` schemas.
- Used by: `app.ts` mounts the aggregate router at `/api`.
- Mounts: `/auth`, `/users`, `/exercises`, `/workouts`, `/workout-sessions` (public API), `/health` and, outside production only, the OpenAPI router at `/`.

**Controllers (`apps/api/src/controllers/`):**
- Purpose: Translate `req` into service input, call a service, shape the HTTP response.
- Location: `apps/api/src/controllers/{auth,exercise,user,workout,workoutSession}.ts`
- Contains: Plain `async` functions (Express 5 forwards rejected promises to `next`). Response envelope `{ success, message, data }`. `requireUserUuid(req, res)` guards authenticated routes.
- Depends on: `services/`, `utils/requireUserUuid`, `http-status-codes`, `@repo/common` types.
- Used by: `routes/`.
- Note: `controllers/workoutSession.ts` serializes the `videoSizeBytes` `BigInt` to `Number` before JSON. Any new `BigInt` field needs the same treatment.

**Services (`apps/api/src/services/`):**
- Purpose: Business logic and all Prisma access.
- Location: `apps/api/src/services/{authService,exerciseService,refreshTokenService,userService,workoutService,workoutSessionService}.ts`
- Contains: Classes with `private get prisma()`, exported as `export default new XService()`. Throw `NotFoundError`, `BadRequestError`, etc.
- Depends on: `@repo/db` (`getPrismaClient`, enums), `utils/`, `errors/`, `lib/r2` (user service only), `@repo/common` types.
- Used by: `controllers/`.

**Data access (`packages/database/`):**
- Purpose: Prisma schema, generated client, singleton connection.
- Location: `packages/database/prisma/schema.prisma` (+ `prisma/models/*.prisma`, `prisma/enums.prisma`), `packages/database/src/prisma.ts`, `packages/database/src/index.ts`.
- Contains: `connectPrisma` (uses `@prisma/adapter-pg`), `getPrismaClient`, `disconnectPrisma`, and re-exports of the generated client.
- Depends on: Postgres.
- Used by: `apps/api` services and `routes/health.ts`.

**Shared contracts (`packages/common/`):**
- Purpose: Zod schemas and inferred types used by the API and by `apps/native`.
- Location: `packages/common/src/validations/*.ts`, `packages/common/src/constants/messages.ts`.
- Contains: Request schemas (e.g. `createWorkoutSessionSchema`, `createWorkoutSchema`, `workoutLogSchema`) and inferred `*Values` types, plus response shapes such as `WorkoutWithExercises`, `WorkoutListResponse`.
- Depends on: `zod` only.
- Used by: `apps/api/src/routes`, `apps/api/src/controllers`, `apps/native/src/api/endpoints`, `apps/native/src/hooks`.

**Cross-cutting infrastructure (`apps/api/src/lib/`):**
- `logger.ts`: pino singleton with `base: { service, env }`, redaction paths, `pino-pretty` only in `development`.
- `redis.ts`, `queue.ts`: Redis connection and BullMQ queue (scaffolding; see above).
- `r2.ts`: S3 client pointed at Cloudflare R2 with keep-alive agent and timeouts.
- `shutdown.ts`: SIGINT/SIGTERM and uncaught/unhandled handlers, 10s force-exit timer, closes server, queue, Redis and Prisma in order.

**Native client (`apps/native/`):**
- Purpose: Expo Router app; talks to the API through a fetch wrapper and TanStack Query hooks.
- Location: `apps/native/app/` (routes), `apps/native/src/` (everything else).
- Layers inside `src/`:
  - `api/client.ts`: fetch wrapper; injects `Authorization: Bearer` from `tokenStore`, 10s timeout, maps failures to `ApiError`, calls `onUnauthenticated` on 401.
  - `api/endpoints/*.ts`: typed wrappers per resource (`authApi`, `userApi`, `workoutApi`, `exerciseApi`), path builders in `src/constants/routes.ts`.
  - `api/keys.ts`: TanStack Query key factories.
  - `hooks/queries/*`, `hooks/mutations/*`: data hooks; `hooks/*` for feature logic (`useWorkoutExecution`, `useWorkoutBuilder`, `useLogin`, `useRegister`, `useProfileEdit`, `useNotificationReminder`).
  - `context/AuthContext.tsx`, `context/ThemeContext.tsx`: app-wide providers.
  - `state/pickedExerciseStore.ts`: module-level store for passing a picked exercise between screens without route params.
  - `components/`, `theme/`: presentational pieces.
  - `types/`: local UI/form-state shapes only. API response shapes come from `@repo/common`.

**UI library (`packages/ui/`):**
- Purpose: Shared React Native primitives (`ScreenHeader`, `SwitchRow`, auth widgets under `src/auth/`).
- Location: `packages/ui/src/`
- Used by: `apps/native` (for example `app/(auth)/login.tsx`, `app/(main)/(tabs)/settings.tsx`).

## Data Flow

**Authenticated JSON request (current implementation):**

1. Native `apiClient` (`apps/native/src/api/client.ts`) attaches `Authorization: Bearer <access token>` from `tokenStore`.
2. Express: `helmet` → `cors` → `express.json` → `pinoHttp` → `/api` router.
3. Route (e.g. `apps/api/src/routes/workoutSession.ts`) runs `authenticateToken` (`apps/api/src/middlewares/auth/authentication.ts`), which sets `req.user`.
4. `validateSchema` parses `{ body, query, params }` with the Zod schema, replaces `req.body`/`req.query`, or responds 400 `Validation Error`.
5. Controller calls `requireUserUuid(req, res)`, then the service with the UUID.
6. Service resolves the internal integer user ID via `utils/getUserIdByUuid.ts`, runs Prisma queries, and throws typed errors on failure.
7. Controller returns `{ success, message, data }`.
8. Errors: `middlewares/errorHandler.ts` reads `status` from the thrown error (defaults to 500), logs 5xx with `{ err }`, returns `{ success: false, message, code }`. Stack is included only when not in production.
9. Native TanStack Query caches the result under keys from `apps/native/src/api/keys.ts`.

**Pagination (shared pattern):**
- Services fetch `take: lookAheadTake(limit)` and call `paginate(items, limit, offset)` from `apps/api/src/utils/pagination.ts` to compute `hasMore` without a count query.

**Session creation (API only, current):**
1. `POST /api/workout-sessions` with `exerciseCode`, optional `notes`, `performedAt`, optional `videoMeta`. No native code calls this endpoint today.
2. `workoutSessionService.createSession` looks up an active exercise by code (`NotFoundError` if missing), creates a `WorkoutSession` with `PENDING`.
3. Nothing advances the status. There is no worker.

**Workout execution (native, current):** `apps/native/app/(main)/workout-execute.tsx` runs the set/rest timer (`useWorkoutExecution`) and on completion calls `useStartWorkout`, which posts a `WorkoutLog` to `POST /api/workouts/:id/logs` (`workoutApi.startLog`). No camera or keypoint code is involved.

**Avatar upload:**
1. Native requests a presigned URL (`POST /api/users/me/avatar-upload-url`, from `USER_ROUTES.avatarUploadUrl`).
2. `userService` builds key `avatars/<userUuid>/<timestamp>.jpg`, signs a 300-second PUT via `@aws-sdk/s3-request-presigner` against `lib/r2.ts`, and returns `uploadUrl` plus `publicUrl` on `R2_PUBLIC_DOMAIN`.
3. Client PUTs the image directly to R2, then saves `avatarUrl` through `PATCH /api/users/me`.

**Planned analysis flow (not implemented):** phone runs pose estimation on-device → `POST /api/sessions/:id/capture` stores a `PoseCapture`, sets `PROCESSING`, enqueues → BullMQ worker computes metrics (shared pure TypeScript in `@repo/common`), calls the LLM, writes `AnalysisResult`/`AnalysisFinding`, sets `COMPLETED`/`FAILED` → SSE `GET /api/sessions/:id/status` pushes progress. Described in `docs/architecture.md`.

**State Management:**
- Server: Postgres via Prisma; Redis for queue (scaffold only).
- Client server-cache: TanStack Query (`QueryClient` in `apps/native/app/_layout.tsx`, `staleTime` 5 minutes, no retry on 401).
- Client auth: `context/AuthContext.tsx` over `api/tokenStore.ts` (expo-secure-store).
- Client transient feature state: React state in hooks (`useWorkoutExecution`, `useCountdown`), plus the module store `state/pickedExerciseStore.ts`.

## Key Abstractions

**Service singleton:**
- Purpose: Encapsulate a resource's business logic and Prisma access.
- Examples: `apps/api/src/services/workoutSessionService.ts`, `apps/api/src/services/workoutService.ts`
- Pattern: `class XService { private get prisma() { return getPrismaClient(); } ... }` then `export default new XService()`.

**Typed HTTP errors:**
- Purpose: Map domain failures to status codes without touching `res`.
- Examples: `apps/api/src/errors/NotFoundError.ts`, `UnauthorizedError.ts`, `ConflictError.ts`, `ServiceUnavailableError.ts`, barrel `apps/api/src/errors/index.ts`, base `ApiError.ts`.
- Pattern: Throw from service; `errorHandler` reads `status`.

**Validation schema bundle:**
- Purpose: One Zod schema per endpoint, shaped `z.object({ body, query, params })`.
- Examples: `apps/api/src/routes/workoutSession.ts` (inline `listWorkoutSessionsQuerySchema` for query, `createWorkoutSessionSchema` from `@repo/common` for body).
- Pattern: Route-local schemas for query/params; body schemas in `packages/common`.

**Shared Zod contracts:**
- Purpose: Single source of truth for request bodies and response shapes across API and native.
- Examples: `packages/common/src/validations/workout.ts`, `workoutSession.ts`, `auth.ts`.
- Pattern: `export const xSchema = z.object(...)` plus `export type XValues = z.infer<typeof xSchema>`.

**Pagination helpers:**
- Purpose: Look-ahead pagination with no count query.
- Examples: `apps/api/src/utils/pagination.ts` (`lookAheadTake`, `paginate`), `apps/api/src/utils/parseDate.ts` (`parseOptionalDate`).

**Auth middleware chain:**
- Purpose: Authenticate, optionally authenticate, and authorize.
- Examples: `apps/api/src/middlewares/auth/authentication.ts` (`authenticateToken`, mounted on most routes), `optionalAuth.ts` (used by `routes/exercise.ts`), `authorization.ts` (`authorize`, not mounted yet).
- Rate limiting: `apps/api/src/middlewares/authRateLimiter.ts` on `register`/`login` in `routes/auth.ts`.

**Query-key factories and endpoint modules (native):**
- Examples: `apps/native/src/api/keys.ts`, `apps/native/src/api/endpoints/workouts.ts`.

**Video-analysis job contract (scaffold):**
- Examples: `apps/api/src/lib/queue.ts` (`VideoAnalysisJobData`, `videoAnalysisQueue`). Expect this type to change when the keypoint pipeline is built.

## Entry Points

**API server:**
- Location: `apps/api/src/index.ts`
- Triggers: `yarn workspace api dev` (`tsx watch`), or `node dist/index.js` after `tsup` build.
- Responsibilities: Validate env (via `config/env.ts` import), connect Prisma, listen on `PORT` (default 3000), register shutdown handlers.

**Express app factory (for tests):**
- Location: `apps/api/src/app.ts` (`createApp`)
- Triggers: Imported by integration tests (Supertest), does not listen.

**Native app root:**
- Location: `apps/native/app/_layout.tsx` (Expo Router root layout, providers), `apps/native/index.js` (entry).
- Triggers: Expo dev client / EAS build.
- Responsibilities: Gesture handler, TanStack Query, auth and theme providers, `(auth)` and `(main)` stacks.

**Route groups:** `apps/native/app/(auth)/` (login, register) and `apps/native/app/(main)/` (tabs plus detail screens). The root stack in `apps/native/app/_layout.tsx` registers both.

**Main tabs:** `apps/native/app/(main)/(tabs)/_layout.tsx` with `index.tsx` (home), `workouts.tsx`, `settings.tsx`.

**Worker (planned):** no entry point exists. When added, the natural location is a second entry in `apps/api/tsup.config.ts` (currently only `src/index.ts`), using the already-declared `SERVICE_NAME=worker` and a `derived logger.child({ jobId, sessionId })` per job, as required by `CLAUDE.md`.

## Error Handling

**Strategy:** Throw typed errors in services; let Express 5 forward rejected async handlers to a single error middleware; validate input before controllers run.

**Patterns:**
- Input: `validateSchema` returns 400 `{ success: false, message: "Validation Error", details }` before the controller runs.
- Domain: services throw `NotFoundError`, `BadRequestError`, `ConflictError`, `UnauthorizedError`, `ForbiddenError`, `ServiceUnavailableError`, `InternalError`. `errorHandler` uses the numeric `status` property.
- Prisma: `apps/api/src/utils/prismaErrorCodes.ts` defines the codes, but no service imports it at present.
- Unknown errors: 500 `Internal Server Error`; 5xx logged as `{ err }` through pino.
- Process-level: `lib/shutdown.ts` logs and shuts down on `uncaughtException` / `unhandledRejection`.
- Native: `apps/native/src/api/client.ts` converts all failures to `ApiError(status, message)`; the root `QueryClient` skips retries on 401.

## Cross-Cutting Concerns

**Logging:** Structured pino via `apps/api/src/lib/logger.ts`; HTTP via `pino-http` (auto-logging disabled in `test`). `console.*` appears only in `apps/api/src/config/env.ts` (env validation failure) and `packages/database/src/prisma.ts` (disconnect messages). Do not add more in `apps/api/src`.

**Validation:** Zod at the boundary (`validateSchema`) for API; Zod env schema in `apps/api/src/config/env.ts`; the native app uses `react-hook-form` with `@hookform/resolvers` and the `@repo/common` schemas.

**Authentication:** JWT access token (`utils/generateJwtToken.ts`, `config/env` `JWT_EXPIRES_IN`, default 15m) verified in `authenticateToken`. Refresh tokens are persisted and rotated (`services/refreshTokenService.ts`, `utils/generateRefreshToken.ts`). Native stores tokens in `api/tokenStore.ts`.

**Security headers and CORS:** `helmet()` and an explicit origin allow-list from `CORS_ALLOWED_ORIGINS` with `credentials: true` (`apps/api/src/app.ts`).

**Configuration:** All env vars go through `apps/api/src/config/env.ts`; the rest of the API reads `env`, never `process.env`. Constants in `apps/api/src/config/constants.ts`.

**Object storage:** Cloudflare R2 for avatars only (`apps/api/src/lib/r2.ts`). Per `docs/architecture.md`, video and frames are never stored.

---

*Architecture analysis: 2026-10-21*
