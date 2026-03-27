# Testing Patterns

**Analysis Date:** 2026-03-21

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `apps/api/vitest.config.ts`

**Assertion Library:**
- Vitest built-in (Jest-compatible API via `globals: true`)

**HTTP Testing:**
- `supertest` 7.x — used for all HTTP request assertions

**Run Commands:**
```bash
cross-env NODE_ENV=test vitest          # Run all tests
cross-env NODE_ENV=test vitest --watch  # Watch mode
# Coverage not configured
```

From the monorepo root:
```bash
yarn test    # Runs turbo run test across all packages
```

## Vitest Configuration

From `apps/api/vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    clearMocks: true,
    restoreMocks: true,
    fileParallelism: false,         // Tests run sequentially across files
    sequence: { concurrent: false }, // Tests within a file run sequentially
    pool: "forks",                  // Each test file runs in a separate process
  },
});
```

Key decisions:
- `fileParallelism: false` and `sequence: { concurrent: false }` ensure serial execution — required because all tests share a single test database
- `pool: "forks"` isolates each test file in a subprocess
- `.env.test` is loaded automatically (via `dotenv` in `vitest.config.ts`)

## Test File Organization

**Location:** Separate `tests/` directory at `apps/api/tests/`, not co-located with source

**Structure:**
```
apps/api/tests/
├── globalSetup.ts                        # One-time DB reset before all suites
├── setup.ts                              # Per-worker safety assertions
├── integration/
│   ├── health.test.ts
│   ├── auth/
│   │   ├── login.test.ts
│   │   └── register.test.ts
│   ├── users/
│   │   ├── getMe.test.ts
│   │   └── getUserByUuid.test.ts
│   ├── exercises/
│   │   ├── listExercises.test.ts
│   │   └── getExerciseByCode.test.ts
│   ├── sessions/
│   │   ├── createSession.test.ts
│   │   └── listSessions.test.ts
│   ├── builders/
│   │   ├── registerUserBuilder.ts
│   │   ├── loginUserBuilder.ts
│   │   ├── exerciseBuilder.ts
│   │   └── workoutSessionBuilder.ts
│   └── helpers/
│       ├── testSetup.ts
│       ├── db/
│       │   └── exerciseHelper.ts
│       └── requestSender/
│           ├── authRequests.ts
│           ├── usersRequests.ts
│           ├── exercisesRequests.ts
│           └── sessionsRequests.ts
```

**Naming:**
- Test files: `[action|resource].test.ts` (e.g., `listExercises.test.ts`, `login.test.ts`)
- Builders: `[resource]Builder.ts`
- Request senders: `[resource]Requests.ts`

## Test Structure

**Suite Organization:**

```typescript
describe("POST /api/users/register", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should register a new user successfully", async () => { ... });
  it("should return 400 for missing email", async () => { ... });
  it("should return 409 for duplicate email", async () => { ... });
});
```

**describe label convention:** `"HTTP_METHOD /api/resource/path"` — matches the actual route

**it label convention:** `"should [expected behavior]"` or `"should return [status] for [condition]"`

**Setup/Teardown:**
- `beforeAll` + `afterAll` are used (not `beforeEach`/`afterEach`) for most suites — the full DB is cleaned once per describe block
- Exception: `listExercises.test.ts` and `getExerciseByCode.test.ts` use `afterEach` to delete only the specific records they created (tracked via `createdExerciseIds` array), allowing fine-grained cleanup between tests within a suite

## Test Setup Infrastructure

**`tests/globalSetup.ts`** — runs once before the entire test run:
- Guards: aborts if `NODE_ENV !== "test"` or `DATABASE_URL` does not contain `_test`
- Resets the test database by running `yarn db:migrate:reset` via `execSync`

**`tests/setup.ts`** — runs before each worker:
- Validates `NODE_ENV === "test"` and `DATABASE_URL` includes `_test`
- Prevents accidental execution against non-test databases

**`tests/integration/helpers/testSetup.ts`** — per-suite lifecycle:
```typescript
export const setupIntegrationTest = async (): Promise<TestAppContext> => {
  const app = createApp();
  await connectPrisma(process.env.DATABASE_URL!, false);
  const prisma = getPrismaClient();
  return { app, prisma };
};

export const teardownIntegrationTest = async (prisma) => {
  await cleanupDatabase(prisma);  // deleteMany on all tables in dependency order
  await prisma.$disconnect();
};
```

`cleanupDatabase` deletes in foreign-key safe order:
```typescript
await prisma.analysisFinding.deleteMany();
await prisma.analysisResult.deleteMany();
await prisma.userMilestone.deleteMany();
await prisma.userGoal.deleteMany();
await prisma.bodyMetric.deleteMany();
await prisma.workoutSession.deleteMany();
await prisma.milestoneDefinition.deleteMany();
await prisma.exercise.deleteMany();
await prisma.user.deleteMany();
```

## Test Data Builders

The Builder pattern is used for all test data. Each builder:
- Has a constructor with sensible defaults (using `randomUUID().split("-")[0]` for unique suffixes)
- Has fluent `set*` methods returning `this` for chaining
- Has a `build()` method returning a plain DTO object

```typescript
// Create with defaults
const user = new RegisterUserBuilder().build();

// Override specific fields
const user = new RegisterUserBuilder()
  .setEmail("duplicate@example.com")
  .setPassword(undefined)   // force missing field
  .build();

// Cross-builder initialization
const loginDto = new LoginUserBuilder()
  .fromRegisterDto(registerDto)
  .build();
```

**Builder files:** `apps/api/tests/integration/builders/`
- `registerUserBuilder.ts` — `RegisterUserBuilder`, `RegisterUserDto`
- `loginUserBuilder.ts` — `LoginUserBuilder`, `LoginUserDto`
- `exerciseBuilder.ts` — `ExerciseBuilder`, `ExerciseDto`
- `workoutSessionBuilder.ts` — `WorkoutSessionBuilder`, `WorkoutSessionDto`

## DB Helpers

**`tests/integration/helpers/db/exerciseHelper.ts`:**
```typescript
export const createExercise = async (
  prisma: ReturnType<typeof getPrismaClient>,
  overrides?: Partial<ExerciseDto>,
) => {
  const exerciseData = { ...new ExerciseBuilder().build(), ...overrides };
  return prisma.exercise.create({ data: exerciseData });
};
```

Pattern: DB helpers accept `prisma` as first argument plus an optional `overrides` object, merging with builder defaults. Used for direct DB seeding when HTTP creation is not the focus of the test.

## Request Sender Helpers

Each resource has a typed request sender file in `tests/integration/helpers/requestSender/`. They wrap `supertest` calls:

```typescript
// Auth requests (no token required)
export const registerUser = async (app, userRegisterData) =>
  supertest.agent(app).post("/api/users/register")
    .set("Content-Type", "application/json")
    .send(userRegisterData);

// Authenticated requests (optional token)
export const createWorkoutSession = async (app, token, data) => {
  const request = supertest.agent(app).post("/api/sessions")
    .set("Content-Type", "application/json");
  if (token) request.set("Authorization", `Bearer ${token}`);
  return request.send(data);
};

// Query string requests
export const listExercises = async (app, query?) => {
  const request = supertest.agent(app).get("/api/exercises");
  if (query) request.query(query);
  return request;
};
```

## Test Types

**Unit Tests:** Not present — no unit test files exist in the codebase.

**Integration Tests:** All tests are integration tests hitting the real Express app via `supertest` against a real PostgreSQL test database. No mocking of services, repositories, or database.

**E2E Tests:** Not configured.

## Common Assertion Patterns

**Happy path — check status, shape, and specific field values:**
```typescript
expect(response.status).toBe(StatusCodes.CREATED);
expect(response.body.success).toBe(true);
expect(response.body.data).toHaveProperty("user");
expect(response.body.data).toHaveProperty("token");
expect(response.body.data.user.email).toBe(user.email);
expect(response.body.data.user).not.toHaveProperty("password");
```

**Error path — check status code and message:**
```typescript
expect(response.status).toBe(StatusCodes.BAD_REQUEST);
expect(response.body.details[0].message).toBe("body.email - Enter a valid email");

expect(response.status).toBe(StatusCodes.CONFLICT);
expect(response.body.message).toBe("User with this email already exists");
```

**Pagination assertions:**
```typescript
expect(response.body.data.items).toHaveLength(2);
expect(response.body.data.page.hasMore).toBe(true);
expect(response.body.data.page.nextOffset).toBe(2);
```

**DB state verification (used when HTTP response alone is insufficient):**
```typescript
const storedSession = await prisma.workoutSession.findUnique({
  where: { id: response.body.data.id },
  include: { exercise: true },
});
expect(storedSession).not.toBeNull();
expect(storedSession?.exercise.code).toBe(exercise.code);
```

## Coverage

**Requirements:** None enforced (no coverage thresholds configured in `vitest.config.ts`)

**What is tested:**
- All API routes have integration test files covering: success path, validation errors, auth errors, and business logic errors (not found, conflict)
- Pagination behavior (limit, offset, hasMore, nextOffset) is tested for list endpoints

**What is NOT tested:**
- No unit tests for service classes in isolation
- No unit tests for utility functions (`asyncWrapper`, `generateJwtToken`, `zodErrorMessage`)
- No unit tests for middleware (`authentication`, `authorization`, `validateSchema`)
- No tests for the native app or web app

---

*Testing analysis: 2026-03-21*
