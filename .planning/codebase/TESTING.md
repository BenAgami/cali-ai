# Testing Patterns

**Analysis Date:** 2026-10-21

## Test Framework

**Runner:**
- Vitest `^4.0.17` (declared in `apps/api/package.json`), with `@vitest/coverage-v8` `4.0.18`
- Config: `apps/api/vitest.config.ts`
- Scope: only `apps/api` has tests. `apps/native`, `packages/ui`, `packages/common`, and `packages/database` have no test runner or test files

**Assertion Library:**
- Vitest built-in `expect` (Jest-compatible matchers), plus `supertest` `^7.2.2` for HTTP assertions in integration tests

**Shared root config (applied to both projects via `extends: true`):**
- `environment: "node"`
- `globals: true`. Test files do not import `describe`, `it`, `expect`, or `vi`
- `clearMocks: true`, `restoreMocks: true`, `unstubEnvs: true`. Mocks reset between tests automatically

**Run Commands:**
```bash
yarn workspace api test                 # Run both projects (sets NODE_ENV=test)
yarn workspace api test:unit            # Unit project only, no database needed
yarn workspace api test:integration     # Integration project, needs Postgres on :5433
yarn workspace api test:coverage        # Both projects with v8 coverage
yarn workspace api vitest --watch       # Watch mode (vitest run is the default script)
```

Run from the repo root with `yarn workspace api <script>`. `yarn test` at the root runs the Turborepo `test` task.

## Test Projects

Two Vitest projects are declared in `apps/api/vitest.config.ts`:

| Setting | `unit` | `integration` |
|---|---|---|
| Include | `tests/unit/**/*.test.ts` | `tests/integration/**/*.test.ts` |
| Env | `test.env: unitEnv` from `tests/unit/helpers/unitEnv.ts` | from `.env.test` / CI env |
| Setup | none | `tests/setup.ts` (asserts `NODE_ENV=test` and `_test` in `DATABASE_URL`) |
| Global setup | none | `tests/globalSetup.ts` (runs `yarn --cwd packages/database db:migrate:deploy`) |
| Pool | `threads` | `forks` |
| File parallelism | `true` | `false` |
| Sequencing | default | `sequence: { concurrent: false }` |

**Unit tests must not touch the network or a database.** `yarn workspace api test:unit` must pass with Docker stopped. `vitest.config.ts` loads `dotenv` from `.env.test` at the top, but the unit project does not depend on it: `unitEnv` supplies every variable inline. `tests/unit/config/env.test.ts` asserts that `unitEnv` and `src/config/env.ts` stay in sync. When you add an env var to `env.ts`, add it to `tests/unit/helpers/unitEnv.ts` too.

**Database:** two Postgres instances from `docker-compose.yaml`:
- `:5434` for development
- `:5433` for tests. Integration tests must target a database whose name contains `_test`

## Test File Organization

**Location:**
- All tests live under `apps/api/tests/`. Never co-locate `*.test.ts` in `apps/api/src/`. `tsconfig.json`, the ESLint test override, and the tsup build all key off this boundary
- Unit tests mirror `src/`:
  ```
  tests/unit/
    config/          env.test.ts
    controllers/     exercise.test.ts, workoutSession.test.ts
    errors/          apiError.test.ts
    helpers/         expressMocks.ts, prismaMock.ts, unitEnv.ts
    lib/             shutdown.test.ts
    middlewares/     errorHandler.test.ts, validateSchema.test.ts
                     auth/authentication.test.ts, authorization.test.ts, optionalAuth.test.ts
    services/        authService.test.ts, exerciseService.test.ts, refreshTokenService.test.ts,
                     userService.test.ts, workoutService.test.ts, workoutSessionService.test.ts
    utils/           pagination.test.ts, parseDate.test.ts, toError.test.ts, zodErrorMessage.test.ts,
                     normalizeString.test.ts, prismaErrorCodes.test.ts, requireUserUuid.test.ts,
                     getUserIdByUuid.test.ts, generateRefreshToken.test.ts
    smoke.test.ts   (bootstrap check: env imports without a .env file)
  ```
- Integration tests are grouped by resource, one file per endpoint behavior:
  ```
  tests/integration/
    auth/            register.test.ts, login.test.ts, refresh.test.ts, logout.test.ts
    users/           getMe.test.ts, getUserByUuid.test.ts, updateProfile.test.ts, goals.test.ts, avatarUpload.test.ts
    workouts/        createWorkout.test.ts, getWorkout.test.ts, listWorkouts.test.ts, updateWorkout.test.ts, deleteWorkout.test.ts, startWorkout.test.ts
    workoutSessions/ createWorkoutSession.test.ts, listWorkoutSessions.test.ts
    exercises/       listExercises.test.ts, getExerciseByCode.test.ts
    health.test.ts
    builders/        registerUserBuilder.ts, loginUserBuilder.ts, workoutBuilder.ts, workoutSessionBuilder.ts, exerciseBuilder.ts
    helpers/
      testSetup.ts
      db/            userHelper.ts, exerciseHelper.ts, workoutHelper.ts
      requestSender/ authRequests.ts, usersRequests.ts, workoutsRequests.ts, workoutSessionsRequests.ts, exercisesRequests.ts
  ```

**Naming:**
- Files: `*.test.ts`, named after the unit or endpoint under test (`exerciseService.test.ts`, `createWorkout.test.ts`)
- Helpers and builders: `*Builder.ts`, `*Helper.ts`, `*Requests.ts`, `expressMocks.ts`, `prismaMock.ts`

**Test Names:**
- Unit: `describe("ExerciseService.getExerciseByCode")` for classes, `describe("listExercises")` for controllers and functions. Test names are plain present-tense phrases with no `should` prefix: `it("restricts to active exercises by default")`
- Integration: `describe("POST /api/workouts")` at the top, `it("should create a workout with one dynamic exercise")` inside. Integration tests use the `should` prefix (about 96 occurrences across the suite). Keep the convention of the directory you are editing

## Test Structure

**Unit suite pattern** (service):
```typescript
import { getPrismaClient } from "@repo/db";

import { NotFoundError } from "../../../src/errors";

import {
  asPrismaClient,
  createPrismaMock,
  type PrismaMock,
} from "../helpers/prismaMock";

vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));

const { ExerciseService } =
  await import("../../../src/services/exerciseService");

let prisma: PrismaMock;
let exerciseService: InstanceType<typeof ExerciseService>;

beforeEach(() => {
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  exerciseService = new ExerciseService();
});

describe("ExerciseService.getExerciseByCode", () => {
  it("throws when no exercise matches", async () => {
    prisma.exercise.findFirst.mockResolvedValue(null);

    await expect(exerciseService.getExerciseByCode("push_up")).rejects.toThrow(
      new NotFoundError("Exercise not found"),
    );
  });
});
```

**Unit suite pattern** (controller): mock the service default export, import the controller after the mock with top-level `await import`, and drive it through `createMockRequest` / `createMockResponse`:
```typescript
vi.mock("../../../src/services/exerciseService", () => ({
  default: { listExercises: vi.fn(), getExerciseByCode: vi.fn() },
}));

const { listExercises } = await import("../../../src/controllers/exercise");

const res = createMockResponse();
await listExercises(createMockRequest({ query, user }), res);
expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
expect(jsonBody(res)).toEqual({ success: true, message: "...", data: ... });
```

**Structure rules observed:**
- Use nested `describe` blocks for grouping by concern: `describe("errorHandler") > describe("status and body")` in `tests/unit/middlewares/errorHandler.test.ts`
- Use a `run*` helper per file to build the request, call the handler, and return `{ res, error }` or `{ res, body }`. See `runListExercises` in `tests/unit/controllers/exercise.test.ts`
- Put shared setup in a top-level `beforeEach` (`vi.mocked(...).mockResolvedValue(...)`) rather than in every test
- Integration suites: `beforeAll(setupIntegrationTest)` assigns `app` and `prisma`; `afterAll(teardownIntegrationTest)` wipes tables and disconnects

**Assertion patterns:**
- HTTP status: always `StatusCodes` from `http-status-codes`. Unit tests: `expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED)`. Integration: `expect(response.status).toBe(StatusCodes.CREATED)`
  - Known drift: `tests/integration/users/getMe.test.ts` asserts `toBe(200)`. Do not copy this
- Error class: `expect(error).toBeInstanceOf(ForbiddenError)`
- Error message: `await expect(promise).rejects.toThrow(new NotFoundError("..."))` for exact message, or `.rejects.toThrow(ConflictError)` for class only
- Prisma call shape: `expect(prisma.exercise.findMany.mock.calls[0][0]).toMatchObject({ take: 11, skip: 20 })`
- Envelope: `expect(jsonBody(res)).toEqual({ success: true, message, data })`

**Parameterized tests:** `it.for` is used across 14 test files. Tuples carry a label as the first element and `%s` in the title:
```typescript
it.for<[string, Request["user"]]>([
  ["a non-admin user", { sub: "uuid-1", role: Role.USER }],
  ["an anonymous request", undefined],
])("rejects includeInactive for %s", async ([_label, user]) => {
  // ...
});
```
Use `it.for` for matrices of inputs with the same assertion. Use separate `it` blocks when assertions differ.

## Mocking

**Framework:** Vitest `vi` (`vi.fn`, `vi.mock`, `vi.mocked`, `vi.useFakeTimers`). Mocks are reset by the root config (`clearMocks`, `restoreMocks`).

**Prisma (services):**
- Mock `@repo/db` as a *partial* mock using `importOriginal`, because the package also re-exports the generated enums (`Role`, `SessionStatus`) that code needs:
  ```typescript
  vi.mock("@repo/db", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@repo/db")>()),
    getPrismaClient: vi.fn(),
  }));
  ```
- Build the delegate mock with `createPrismaMock()` from `tests/unit/helpers/prismaMock.ts`. It exposes `findUnique`, `findFirst`, `findMany`, `create`, `createMany`, `update`, `updateMany`, `delete`, `deleteMany`, `count` for each model in `MODELS`, plus `$transaction` (runs a callback with the mock or resolves an array)
- Rewire in `beforeEach`: `vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));`
- Services read Prisma through the lazy `private get prisma()` getter, so the rewiring takes effect per call
- Build Prisma errors with `prismaError("P2002", ["email"])` from `tests/unit/helpers/prismaMock.ts`

**Express request/response (controllers and middleware):**
- `createMockRequest(overrides)`, `createMockResponse()`, `createMockNext()`, and `jsonBody(res)` from `tests/unit/helpers/expressMocks.ts`
- `createMockResponse` returns `status`, `json`, and `send` as chainable `vi.fn()`. `jsonBody` returns `unknown` so tests narrow it explicitly
- Controllers are plain async functions: `await handler(req, res)` directly, no wrapper

**Module-level mocks in use:**
- Services: `vi.mock("../../../src/services/<name>", () => ({ default: { method: vi.fn() } }))`
- Infrastructure: `bcrypt`, `@aws-sdk/s3-request-presigner`, `src/lib/redis`, `src/lib/r2`, `src/lib/queue`, `src/lib/logger`, `src/config/env`, `src/utils/generateJwtToken`
- Logger mock: `vi.mock("../../../src/lib/logger", () => ({ logger: { error: vi.fn(), debug: vi.fn() } }))`, then assert against the imported mock
- Env toggling: use a mutable object in the mock factory and reset in `beforeEach`. From `tests/unit/middlewares/errorHandler.test.ts`:
  ```typescript
  const mockEnv = { runtimeEnv: "test" as string };
  vi.mock("../../../src/config/env", () => ({ env: mockEnv }));
  beforeEach(() => { mockEnv.runtimeEnv = "test"; });
  ```

**What to Mock:**
- True I/O boundaries only: Prisma (`getPrismaClient`), `bcrypt`, AWS SDK clients, Redis, BullMQ queue, pino logger, `config/env`
- Collaborating services when testing a controller or middleware

**What NOT to Mock:**
- Zod schemas. Use the real schema from `@repo/common`
- `jsonwebtoken`. Sign real tokens with `env.jwt.secret` (see `tests/unit/middlewares/auth/authentication.test.ts`)
- Pure utilities (`normalizeString`, `paginate`, `lookAheadTake`, `toError`). Test them directly
- Private helpers. Test them through the public method that calls them. Do not `export` a helper just to test it (CLAUDE.md)

**Integration tests never mock the database.** Use the real Prisma client from `setupIntegrationTest()` and clean up with `teardownIntegrationTest(prisma)`.

## Fake Timers

- Used in `tests/unit/lib/shutdown.test.ts`, `tests/unit/services/refreshTokenService.test.ts`, and `tests/unit/services/userService.test.ts`
- Pattern: `vi.useFakeTimers()` inside the test or `beforeEach`, advance with `vi.advanceTimersByTime(...)` or `vi.advanceTimersByTimeAsync(...)`, and restore with `vi.useRealTimers()` in `afterEach`. `refreshTokenService.test.ts` restores at line 48
- Reserve fake timers for time-dependent logic: expiry, shutdown timeouts, retry windows

## Fixtures and Factories

**Unit test data:**
- Inline literal objects and small local factories. Examples:
  - `const rows = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i + 1, code: \`ex_${i}\` }));` in `tests/unit/services/exerciseService.test.ts`
  - `const signed = (options, secret) => jwt.sign({ sub: "uuid-1", role: Role.USER }, secret, options);` in `tests/unit/middlewares/auth/authentication.test.ts`
- Roles and enums come from `@repo/db` (`Role.USER`, `Role.ADMIN`). Do not hard-code string roles

**Integration builders** (`apps/api/tests/integration/builders/`): fluent builders produce request DTOs.
```typescript
// apps/api/tests/integration/builders/workoutBuilder.ts
export class WorkoutBuilder {
  private workout: WorkoutDto;
  constructor() {
    this.workout = { name: "Push Day", exercises: [{ exerciseId: 0, sets: 3, reps: 10, restSecs: 60 }] };
  }
  setName(name?: string): WorkoutBuilder { this.workout.name = name; return this; }
  setExercises(exercises: WorkoutExerciseDto[]): WorkoutBuilder { this.workout.exercises = exercises; return this; }
  build(): WorkoutDto { /* returns a shallow copy */ }
}
```
Usage: `new WorkoutBuilder().setExercises([...]).build()`. Builders exist for register, login, workout, workout session, and exercise.

**Integration DB fixtures** (`apps/api/tests/integration/helpers/db/`):
- `createExercise(prisma, { exerciseType })` in `exerciseHelper.ts`
- `createWorkoutFixture(prisma, { userId, exercises })` in `workoutHelper.ts`, which writes via Prisma directly with `include` for assertions
- Use the DB helpers to arrange state that the endpoint under test does not create itself (for example, an exercise row for `POST /api/workouts`)

**Integration request helpers** (`apps/api/tests/integration/helpers/requestSender/`): one function per endpoint that wraps `supertest.agent(app)`. Example `createWorkout(app, token, data)` in `workoutsRequests.ts`. Auth is applied through `withAuth(req, token)`. Pass `undefined` as the token to test unauthenticated behavior.

**Location:**
- Unit helpers: `apps/api/tests/unit/helpers/`
- Integration builders, DB helpers, and request senders: `apps/api/tests/integration/builders/`, `helpers/db/`, `helpers/requestSender/`

## Integration Test Lifecycle

- `setupIntegrationTest()` in `tests/integration/helpers/testSetup.ts` calls `createApp()`, `connectPrisma(process.env.DATABASE_URL!, false)`, and returns `{ app, prisma }`
- `teardownIntegrationTest(prisma)` deletes rows in foreign-key-safe order (`analysisFinding` through `user`) and disconnects. Cleanup runs in `afterAll`, not `beforeAll`. Each suite starts from whatever the previous suite left, so keep teardown complete when adding models
- New tables must be added to `cleanupDatabase` in `tests/integration/helpers/testSetup.ts`
- Integration suites run one file at a time (`fileParallelism: false`), so they can share a database safely

## Coverage

**Requirements:** None enforced. There are no `thresholds` in `apps/api/vitest.config.ts`

**Configuration:**
- Provider: `v8`
- Reporters: `text`, `html`, `lcov`
- Included: `src/**/*.ts`
- Excluded: `src/index.ts`, `src/app.ts`, `src/openapi/**`, `src/routes/**`, `src/types/**`, `src/lib/logger.ts`, `src/lib/queue.ts`, `src/lib/r2.ts`, `src/lib/redis.ts`

**View Coverage:**
```bash
yarn workspace api test:coverage
# HTML report written under apps/api/coverage/
```

**Note:** `@vitest/coverage-v8` is pinned to `4.0.18` and kept in `apps/api/node_modules` through the `nohoist` entry in root `package.json`. Keep it in the same workspace as `vitest`.

## Test Types

**Unit Tests (`tests/unit/`):**
- Scope: single function, class method, controller, or middleware, with Prisma and infrastructure mocked
- Earn their place on branches integration tests cannot reach: error-mapping paths, retry exhaustion, fake-timer logic, exact Prisma call shapes, and boundary inputs
- Do not re-test what integration already proves over HTTP (pagination over HTTP, duplicate-email 409, refresh-token reuse detection)

**Integration Tests (`tests/integration/`):**
- Scope: a single HTTP endpoint through Express (`createApp()`) against real Postgres, using supertest
- Each file covers one endpoint, across its success and failure responses, including auth (`token` undefined) and validation (400)
- Redis and BullMQ are not exercised in integration tests in this repo yet

**E2E Tests:** Not used. The native app has no automated tests.

**Native app (`apps/native`):** no test runner, no `test` script, and no test files. `apps/native/package.json` does not declare Jest or Vitest. Verify by `yarn workspace native check-types` and `yarn workspace native lint` only.

## Common Patterns

**Async Testing (controller):**
```typescript
const { res } = await runListExercises();
expect(exerciseService.listExercises).toHaveBeenCalledWith({
  limit: 20, offset: 0, includeInactive: false,
});
```

**Async error capture (controller with a rejecting handler):**
```typescript
let error: unknown;
await listExercises(req, res).catch((err: unknown) => { error = err; });
expect(error).toBeInstanceOf(ForbiddenError);
```
Use `.catch` capture when the test wants to inspect the error and also check that nothing else was called. Use `await expect(...).rejects` when the error is the only outcome.

**Async Testing (integration):**
```typescript
const response = await createWorkout(app, token, workoutDto);
expect(response.status).toBe(StatusCodes.CREATED);
expect(response.body.data.exercises).toHaveLength(1);
const dbExercises = await prisma.workoutExercise.findMany({ where: { workoutId: response.body.data.id } });
expect(dbExercises).toHaveLength(1);
```
Assert both the HTTP response and the persisted row for write endpoints.

**Error Testing (unit, middleware):**
```typescript
const { error } = run("Basic abc");
expect(error).toBeInstanceOf(UnauthorizedError);
expect((error as Error).message).toBe("Authorization header missing or malformed");
```

**Error Testing (integration):**
```typescript
const response = await createWorkout(app, undefined, workoutDto);
expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
expect(response.body.success).toBe(false);
```

**Documenting pinned behavior:** when a test locks in behavior that is arguably wrong, add a comment on the test that says so and that the test is not an endorsement. CLAUDE.md requires this for cases such as inactive exercises being visible to any authenticated user (`getExerciseByCode` in `tests/unit/controllers/exercise.test.ts`). The current test has no such comment. Add one when you touch it.

## Gaps to Know About

- No unit tests for `controllers/auth.ts`, `controllers/user.ts`, or `controllers/workout.ts`. Those routes are covered only by integration tests
- `tests/unit/controllers/workoutSession.test.ts` pins the video-era `videoSizeBytes` bigint serialization. Update it along with the controller when the keypoint capture flow replaces video metadata
- Integration assertions mix `StatusCodes.*` and raw numbers. Prefer `StatusCodes`
- Native app has no automated tests, so UI behavior is verified manually on the Expo dev build

---

*Testing analysis: 2026-10-21*
