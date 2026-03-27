# Architecture

**Analysis Date:** 2026-03-21

## Pattern Overview

**Overall:** Turborepo monorepo with layered REST API backend, React Native mobile client, and Next.js web client. Shared packages provide the database layer and common validation schemas.

**Key Characteristics:**
- Three-tier API: Routes → Controllers → Services, all wired through Express 5
- Database access is centralised in `packages/database` (`@repo/db`); no other app touches Prisma directly
- Zod schemas are defined once in `packages/common` (`@repo/common`) and imported by both the API and the native client for runtime validation
- JWT-based stateless auth (Bearer token); role-based authorization via a higher-order middleware factory
- Async errors are caught by a thin `asyncWrapper` and forwarded to a central `errorHandler`

## Layers (API — `apps/api`)

**Entry Point:**
- Purpose: Boot sequence — validates env, connects Prisma, starts Express
- Location: `apps/api/src/index.ts`
- Depends on: `@repo/db` (connectPrisma), `./config/env`, `./app`

**App Factory:**
- Purpose: Registers global middleware and mounts route groups
- Location: `apps/api/src/app.ts`
- Middleware stack (in order): helmet → cors → json → urlencoded → morgan → `/api` routes → 404 handler → errorHandler

**Routes Layer:**
- Purpose: Declares HTTP verbs + paths, wires middleware + controller functions
- Location: `apps/api/src/routes/`
- Key files:
  - `apps/api/src/routes/index.ts` — aggregates sub-routers under `/api`
  - `apps/api/src/routes/user.ts` — `/api/users`
  - `apps/api/src/routes/session.ts` — `/api/sessions`
  - `apps/api/src/routes/exercise.ts` — `/api/exercises`
  - `apps/api/src/routes/health.ts` — `/api/health`
- Depends on: Middleware (`validateSchema`, `authenticateToken`, `authorize`), Controllers

**Controllers Layer:**
- Purpose: Parse validated request data, call service, format JSON response
- Location: `apps/api/src/controllers/`
- Key files:
  - `apps/api/src/controllers/user.ts`
  - `apps/api/src/controllers/workoutSession.ts`
  - `apps/api/src/controllers/exercise.ts`
- All controller functions are wrapped with `asyncWrapper` from `apps/api/src/utils/asyncWrapper.ts`
- Depends on: Services, `@repo/common` (typed DTOs)

**Services Layer:**
- Purpose: Business logic, data access via Prisma, error throwing
- Location: `apps/api/src/services/`
- Key files:
  - `apps/api/src/services/userService.ts` — register, login, getUserByUuid/Email
  - `apps/api/src/services/workoutSessionService.ts` — createSession, listSessions (with offset pagination)
  - `apps/api/src/services/exerciseService.ts` — listExercises, getExerciseByCode
- Pattern: Exported as singleton (`export default new XService()`); `getPrismaClient()` accessed lazily via a getter to guarantee it is initialised
- Depends on: `@repo/db` (getPrismaClient, enums), `@repo/common` (value types), `apps/api/src/errors/*`

**Middleware Layer:**
- Purpose: Cross-cutting request concerns
- Location: `apps/api/src/middlewares/`
- Key files:
  - `apps/api/src/middlewares/authentication.ts` — JWT Bearer verification, attaches `req.user`
  - `apps/api/src/middlewares/authorization.ts` — role-check factory: `authorize(...roles)(req, res, next)`
  - `apps/api/src/middlewares/validateSchema.ts` — Zod schema runner against `{ body, query, params }`
  - `apps/api/src/middlewares/errorHandler.ts` — terminal Express error middleware; reads `error.status`

**Error Layer:**
- Purpose: Typed HTTP error classes; carry a `status` property consumed by `errorHandler`
- Location: `apps/api/src/errors/`
- Base: `ApiError` extends `Error` with `status` + `statusCode`
- Subclasses: `BadRequestError`, `ConflictError`, `ForbiddenError`, `InternalError`, `NotFoundError`, `UnauthorizedError`

## Data Flow

**Authenticated Request:**
1. Request arrives at Express
2. `helmet` / `cors` / `morgan` middleware execute
3. Route-level `validateSchema` parses and coerces `body`, `query`, `params` via Zod; returns 400 on failure
4. `authenticateToken` verifies the Bearer JWT; attaches decoded payload to `req.user`; throws on failure
5. Optional `authorize(...roles)` checks `req.user.role`
6. `asyncWrapper` invokes the controller function; `.catch(next)` forwards thrown errors
7. Controller calls the service method with typed arguments
8. Service calls `getPrismaClient()` to query PostgreSQL
9. Service returns data or throws a typed `ApiError` subclass
10. Controller serialises the result and calls `res.json()`
11. On error path: `errorHandler` middleware reads `error.status` and sends a `{ success: false, message }` response

**Unauthenticated Request (register/login):**
- Steps 1–4 run without `authenticateToken`
- `validateSchema` still enforces Zod schemas from `@repo/common`

**State Management (Native App):**
- Theme preference persisted to `AsyncStorage` via `ThemeContext` (`apps/native/src/context/ThemeContext.tsx`)
- No global auth state management present yet (login handlers are stubbed in `apps/native/app/(auth)/login.tsx`)

## Key Abstractions

**`asyncWrapper`:**
- Purpose: Eliminates try/catch boilerplate in controllers
- Location: `apps/api/src/utils/asyncWrapper.ts`
- Pattern: `(fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`

**`validateSchema` middleware:**
- Purpose: Single validation point; routes pass a Zod schema wrapping `body`, `query`, and `params`
- Location: `apps/api/src/middlewares/validateSchema.ts`
- Pattern: `validateSchema(z.object({ body: someSchema, query: otherSchema }))`

**`@repo/db` package:**
- Purpose: Wraps Prisma client lifecycle; exports `connectPrisma`, `disconnectPrisma`, `getPrismaClient`, and all generated Prisma types/enums
- Location: `packages/database/src/prisma.ts`, `packages/database/src/index.ts`
- Uses `@prisma/adapter-pg` (native pg driver adapter) instead of Prisma's default driver

**`@repo/common` package:**
- Purpose: Shared Zod schemas and inferred TypeScript types consumed by both API and native client
- Location: `packages/common/src/validations/auth.ts`, `packages/common/src/validations/workoutSession.ts`
- Exports: `loginSchema`, `registerSchema`, `createWorkoutSessionSchema` and their inferred `*Values` types

**`@repo/ui` package:**
- Purpose: Shared React Native UI primitives, primarily auth-screen components
- Location: `packages/ui/src/`
- Exports: `AuthHeader`, `AuthInput`, `AuthImageHeader`, `AuthFooter`, `AuthOrDivider`, `GoogleSignInButton`, `AuthRememberRow`, `ScreenHeader`, `SwitchRow`

**Offset Pagination Pattern:**
- All list endpoints (exercises, sessions) use `limit + 1` over-fetch to determine `hasMore`
- Response shape: `{ items, page: { limit, offset, hasMore, nextOffset } }`
- Implemented in: `apps/api/src/services/exerciseService.ts`, `apps/api/src/services/workoutSessionService.ts`

## Entry Points

**API Server:**
- Location: `apps/api/src/index.ts`
- Triggers: `node dist/index.js` (prod) / `ts-node-dev` (dev)
- Responsibilities: Env validation, Prisma connect, Express listen, graceful SIGINT/SIGTERM shutdown

**Native App:**
- Location: `apps/native/app/_layout.tsx`
- Triggers: `expo start`
- Responsibilities: Root Stack navigator setup, `ThemeProvider` wrapping, `SafeAreaProvider`

**Web App:**
- Location: `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`
- Triggers: `next dev` / `next build`
- Responsibilities: Minimal Next.js 14 app router scaffold (largely a placeholder)

## Error Handling

**Strategy:** Typed error class hierarchy; all async errors funnel to Express's global error handler via `asyncWrapper`

**Patterns:**
- Services throw `ApiError` subclasses (`NotFoundError`, `ConflictError`, etc.) which carry the correct HTTP status code
- `validateSchema` middleware returns 400 directly without throwing (does not forward to `errorHandler`)
- `errorHandler` uses `error.status || 500` — custom errors are transparently mapped to HTTP status codes
- Prisma-specific codes (e.g. `P2002` unique violation) are caught in services and re-thrown as typed errors

## Cross-Cutting Concerns

**Logging:** `morgan("dev")` for HTTP request logging; `console.error` in `errorHandler` and startup. No structured logging library.

**Validation:** Zod at the HTTP boundary via `validateSchema` middleware; env variables validated with Zod in `apps/api/src/config/env.ts` at startup.

**Authentication:** Stateless JWT (HS256). Token payload contains `sub` (user UUID) and `role`. `req.user` is typed via Express namespace augmentation in `apps/api/src/types/express.d.ts`.

**Database Schema:** Split Prisma schema files under `packages/database/prisma/models/` — one file per model plus `enums.prisma`. Prisma generates client into `packages/database/generated/prisma/`. UUIDs use `uuidv7()` PostgreSQL extension, internal PKs are `autoincrement()` integers.

---

*Architecture analysis: 2026-03-21*
