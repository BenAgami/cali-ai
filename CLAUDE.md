# Cali AI — Claude Code Instructions

## Project Overview

AI-powered calisthenics form feedback app. Users record themselves doing exercises during a set; post-set, Claude analyzes the video and returns a form score + coaching feedback.

Mobile-only for v1. Core exercises: push-up, pull-up, dip, squat.

## Monorepo Structure

```
apps/api          Express 5 REST API (TypeScript)
apps/native       React Native + Expo SDK 54 (Expo Router)
packages/database Prisma 7 schema + generated client (@repo/db)
packages/common   Zod schemas shared across apps (@repo/common)
packages/ui       React Native component library (@repo/ui)
```

Package manager: Yarn Classic 1.22.19. Task runner: Turborepo.

## API Conventions

**Three-tier architecture:** route → controller → service → Prisma. No business logic in controllers; no direct Prisma calls outside services.

**Async route handlers need no wrapper.** Express 5's router natively try/catches handler invocation and forwards a rejected returned Promise to `next(error)`, so controllers are plain `async` functions — no `asyncWrapper`, no try/catch.

**Zod validation at boundaries.** Validate all request bodies in middleware before they reach controllers. Schemas live in `packages/common/src/validations/`.

**Response shapes are shared, not duplicated.** Server response shapes used by `apps/native` (e.g. `WorkoutWithExercises`, `ExerciseSummary`) and by `apps/api/src/openapi/schemas.ts` are defined once in `packages/common/src/validations/` and imported by both — never hand-rolled a second time in `apps/native/src/types/` or the OpenAPI registry. `@repo/common` schemas stay framework-agnostic (no `.openapi()` calls) since `apps/native` also consumes them; add OpenAPI-only presentation metadata at the registration site in `apps/api/src/openapi/schemas.ts` instead. `apps/native/src/types/` is for local-only UI/form-state shapes that never cross the API boundary.

**HTTP error hierarchy** is in `apps/api/src/errors/`. Throw typed errors (e.g. `NotFoundError`, `UnauthorizedError`) — the error handler catches them.

**Prisma client** is a singleton exported from `packages/database/src/index.ts`. Never instantiate a new PrismaClient elsewhere.

**Environment variables** are validated at startup via Zod in `apps/api/src/config/env.ts`. Add new vars there with a schema entry — never read `process.env` directly elsewhere in the API.

**Logging** goes through the structured `pino` logger (`apps/api/src/lib/logger.ts`) — never `console.log`/`console.error` in `apps/api/src`. 5xx errors are always logged regardless of `NODE_ENV`. `pino-http` is the only HTTP request logger — it is mounted in every environment, with `autoLogging` disabled under `test` to keep Vitest output clean; dev readability comes from the logger's `pino-pretty` transport, which stays a devDependency since production sets `transport: undefined`. Every log line carries `service`/`env` via the logger's `base` config, and `Error` objects passed as `err` are run through `pino.stdSerializers.err` — always log errors as `{ err: error }`, never interpolate `error.message`/`error.stack` into the message string yourself. `catch (error)` bindings and rejection handlers are typed `unknown` — never pass one straight to `logger`; normalize it first with `toError` from `apps/api/src/utils/toError.ts` (e.g. `logger.error({ err: toError(error) }, "message")`), since a non-`Error` value passed bare to pino silently replaces your log message with the thrown value. Outside HTTP request context (e.g. the BullMQ worker), derive a `logger.child({ jobId, sessionId })` once per job and log through that child so job logs stay correlated — don't log through the bare `logger` singleton from within job processing.

## Linting & Type Checking

ESLint 9 flat config (typescript-eslint, type-checked rules) at the repo root in `eslint.config.mjs`, extended by each workspace's own `eslint.config.mjs`. `apps/native` additionally applies `eslint-plugin-react-hooks`. Run `yarn lint` / `yarn check-types` from the root (Turborepo tasks) or per-workspace. `apps/api/tests/**` relaxes the `no-unsafe-*` rules since `supertest`'s `Response#body` and vitest's `Mock` are typed `any` by design, and `unbound-method` since `vi.mocked(service.method)` is an unbound method reference by construction.

Prettier is enforced in CI via `yarn format:check` (root `.prettierrc`, `printWidth` 80). Run `yarn format` before pushing — hand-written files, test files included, will otherwise fail the gate.

Knip (`knip.ts` at the root) is enforced in CI via `yarn knip` — it fails on unused or unlisted dependencies, unused files, and unused exports across all workspaces. It runs once from the root, not as a Turborepo task. Declare every dependency in the workspace that imports it — don't rely on hoisting from another workspace. Fix findings by deleting dead code; add an `ignoreDependencies` entry (with a comment saying why) only for deps Knip can't see, such as ones loaded by string name or from gitignored generated code, and tag deliberately unused exports `/** @public */`.

syncpack (`.syncpackrc.json` at the root) is enforced in CI via `yarn deps:lint` — every workspace depending on the same package must use the same version range. Run `yarn deps:fix` to align them. Internal `@repo/*` packages are always referenced as `*`. Shared runtime libraries in `packages/ui` (`react`, `react-native`, `@expo/vector-icons`) are `peerDependencies` plus matching `devDependencies`, so the app's copy is the only one installed.

## Phase 1 Scope (Infrastructure)

What Phase 1 is building:

- **Async video upload**: `POST /api/sessions/:id/recording` returns 202 + job ID immediately
- **BullMQ job queue** (Redis-backed): worker processes video analysis off the request thread
- **SSE endpoint**: `GET /api/sessions/:id/status` streams job progress events to the client
- **State machine**: `WorkoutSession.processingStatus` transitions PENDING → PROCESSING → COMPLETED | FAILED; stuck PROCESSING jobs auto-fail after 10 minutes
- **Custom Expo dev build**: `react-native-vision-camera` + `react-native-fast-tflite` configured in `apps/native`

## Database

PostgreSQL via Prisma 7. Two instances run locally via Docker:

- `:5434` — development
- `:5433` — test

Schema: `packages/database/prisma/schema.prisma`. After schema changes run `yarn workspace @repo/db db:generate` to regenerate the client.

## Testing

Vitest 4, configured as two projects in `apps/api/vitest.config.ts`.

**Integration tests** (`apps/api/tests/integration/`) — Vitest + Supertest against a real Postgres on `:5433`. Each suite wipes relevant tables before running. Never mock the database in an integration test. This project owns `tests/globalSetup.ts` (applies test migrations) and `tests/setup.ts` (asserts `NODE_ENV=test` and a `_test` database), runs on `pool: "forks"` with `fileParallelism: false`, and requires a live database.

**Unit tests** (`apps/api/tests/unit/`) — no database, no network, no `globalSetup`, no `setupFiles`; `pool: "threads"` with full file parallelism. `yarn workspace api test:unit` must pass with Docker stopped; if it doesn't, something under test reached a real client. The unit project supplies all env vars inline from `tests/unit/helpers/unitEnv.ts`, wired via `test.env` in `vitest.config.ts` — it never reads `.env.test` (gitignored, absent in CI). Add new env vars there when you add them to `src/config/env.ts`; `tests/unit/config/env.test.ts` asserts the two stay in sync.

Layout mirrors `src/`: `tests/unit/{utils,errors,config,middlewares,services,controllers}/`. Test files are `*.test.ts` and live under `tests/` — never co-located in `src/`, because `tsconfig.json`'s `include`, the eslint `no-unsafe-*`/`unbound-method` relaxation, and the tsup build all key off that boundary.

**Scripts:** `test` (both projects), `test:unit`, `test:integration`, `test:coverage`.

**Unit test conventions:**

- `globals: true` — never import `describe`/`it`/`expect`/`vi`.
- Arrow functions everywhere, including helpers and factories.
- Assert HTTP status via `http-status-codes` `StatusCodes`, never raw numbers.
- Mock Prisma with `createPrismaMock()` from `tests/unit/helpers/prismaMock.ts`, wired in a `beforeEach` via `vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma))`. `vi.mock("@repo/db", ...)` must be a **partial** mock via `importOriginal` — the package also re-exports the generated Prisma enums (`Role`, `SessionStatus`) that the code needs. Services read Prisma through the lazy `private get prisma()` getter, so the mock resolves per call and per-test rewiring works.
- Build fake `req`/`res`/`next` with `tests/unit/helpers/expressMocks.ts`. Controllers are plain `async` functions — `await` the call directly before asserting.
- Test private helpers **through their public caller** with mocked collaborators. Do not add an `export` purely so a test can reach an internal function.
- Prefer real `zod` schemas and a real `jsonwebtoken` over mocking them — only mock at true I/O boundaries (Prisma, bcrypt, AWS SDK, pino, `config/env`).
- Where a test pins behaviour that is arguably wrong (e.g. `getExerciseByCode` grants inactive exercises to any authenticated user), say so in a comment on the test. The test documents current behaviour; the comment records that it isn't an endorsement.

Don't unit-test what the integration suite already proves end-to-end (pagination over HTTP, duplicate-email 409, refresh-token reuse detection). Unit tests earn their place on branches integration can't reach: error-mapping paths, retry exhaustion, time-dependent logic under fake timers, and exact Prisma call shapes.

**Shared helpers over duplicated logic.** Look-ahead pagination goes through `lookAheadTake`/`paginate` (`src/utils/pagination.ts`) and optional date parsing through `parseOptionalDate` (`src/utils/parseDate.ts`) — both are unit-tested once; services assert only that they wire them up correctly.

## Native App

Expo Router file-based routing. Auth screens in `app/(auth)/`, main tabs in `app/(main)/(tabs)/`. Theme tokens in `src/theme/`. Currently a managed workflow build; Phase 1 requires switching to a custom dev build for native camera + ML modules.
