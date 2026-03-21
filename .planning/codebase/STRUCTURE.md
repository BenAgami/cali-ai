# Codebase Structure

**Analysis Date:** 2026-03-21

## Directory Layout

```
cali-ai/                          # Monorepo root (Turborepo + Yarn workspaces)
├── apps/
│   ├── api/                      # Express 5 REST API
│   │   ├── src/
│   │   │   ├── index.ts          # Server bootstrap entry point
│   │   │   ├── app.ts            # Express app factory
│   │   │   ├── config/           # Env validation (Zod)
│   │   │   ├── routes/           # Route declarations + middleware wiring
│   │   │   ├── controllers/      # Request parsing + response formatting
│   │   │   ├── services/         # Business logic + Prisma queries
│   │   │   ├── middlewares/      # Auth, validation, error handling
│   │   │   ├── errors/           # Typed HTTP error classes
│   │   │   ├── types/            # Express augmentation + JWT payload type
│   │   │   └── utils/            # asyncWrapper, JWT generator, Zod error formatter
│   │   └── tests/
│   │       └── integration/      # Vitest integration tests (real DB)
│   │           ├── auth/
│   │           ├── exercises/
│   │           ├── sessions/
│   │           ├── users/
│   │           ├── builders/     # Test data builder classes
│   │           └── helpers/      # testSetup, requestSender helpers, DB helpers
│   ├── native/                   # Expo React Native mobile app
│   │   ├── app/                  # Expo Router file-system routes
│   │   │   ├── _layout.tsx       # Root Stack navigator + providers
│   │   │   ├── (auth)/           # Auth route group (login, register)
│   │   │   └── (main)/(tabs)/    # Tab navigator group (home, settings)
│   │   └── src/
│   │       ├── components/       # App-specific components (e.g. AuthFormFields)
│   │       ├── context/          # React context providers (ThemeContext)
│   │       └── theme/            # Color tokens and theme definitions
│   └── web/                      # Next.js 14 web app (early scaffold)
│       ├── app/                  # App Router (layout.tsx, page.tsx)
│       └── styles/               # CSS modules
├── packages/
│   ├── common/                   # @repo/common — Zod schemas + inferred types
│   │   └── src/
│   │       ├── validations/      # auth.ts, workoutSession.ts
│   │       └── constants/        # Validation error message strings
│   ├── database/                 # @repo/db — Prisma client + generated types
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Generator + datasource config
│   │   │   ├── enums.prisma      # All database enums
│   │   │   ├── models/           # One .prisma file per model
│   │   │   ├── migrations/       # Timestamped migration history
│   │   │   └── seed.ts           # Database seed script
│   │   ├── src/
│   │   │   ├── prisma.ts         # connectPrisma / getPrismaClient / disconnectPrisma
│   │   │   └── index.ts          # Public package exports
│   │   └── generated/prisma/     # Prisma-generated client (committed, not hand-edited)
│   ├── ui/                       # @repo/ui — shared React Native UI components
│   │   └── src/
│   │       ├── auth/             # Auth screen primitives (AuthInput, AuthHeader, etc.)
│   │       ├── ScreenHeader.tsx
│   │       ├── SwitchRow.tsx
│   │       └── index.tsx         # Barrel export
│   └── typescript-config/        # Shared tsconfig base files
├── docs/                         # Project documentation
├── docker-compose.yaml           # Local postgres-dev (:5432) + postgres-test (:5433)
├── turbo.json                    # Turborepo pipeline (build, dev, test, db:*)
├── package.json                  # Root workspace manifest + shared devDependencies
└── tsconfig.json                 # Root TypeScript config (references packages)
```

## Directory Purposes

**`apps/api/src/config/`:**
- Purpose: Environment variable parsing and typed export
- Key files: `apps/api/src/config/env.ts` — Zod schema validates `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` at startup

**`apps/api/src/routes/`:**
- Purpose: Route definitions only — no business logic here
- Pattern: Each resource gets its own file; `index.ts` aggregates them under `/api`
- Key files: `index.ts`, `user.ts`, `session.ts`, `exercise.ts`, `health.ts`

**`apps/api/src/controllers/`:**
- Purpose: Extract request data, delegate to service, return JSON
- Pattern: Functions are NOT class methods; exported as named functions and wrapped with `asyncHandler`
- Key files: `user.ts`, `workoutSession.ts`, `exercise.ts`

**`apps/api/src/services/`:**
- Purpose: All business logic and Prisma queries live here
- Pattern: Class-based singletons. `getPrismaClient()` accessed via a `private get prisma()` getter (lazy evaluation)
- Key files: `userService.ts`, `workoutSessionService.ts`, `exerciseService.ts`

**`apps/api/src/errors/`:**
- Purpose: Typed error objects that carry the correct HTTP status code
- Hierarchy: All extend `ApiError` which extends `Error`
- Key files: `ApiError.ts` (base), `NotFoundError.ts`, `ConflictError.ts`, `UnauthorizedError.ts`, `ForbiddenError.ts`, `BadRequestError.ts`, `InternalError.ts`

**`apps/api/tests/integration/builders/`:**
- Purpose: Builder-pattern factories for test data DTOs
- Key files: `registerUserBuilder.ts`, `loginUserBuilder.ts`, `workoutSessionBuilder.ts`, `exerciseBuilder.ts`

**`apps/api/tests/integration/helpers/`:**
- Purpose: Test infrastructure — app/DB setup, typed request senders
- Key files: `helpers/testSetup.ts` (setup/teardown with full DB cleanup), `helpers/requestSender/authRequests.ts`, `helpers/requestSender/usersRequests.ts`, `helpers/requestSender/exercisesRequests.ts`, `helpers/requestSender/sessionsRequests.ts`, `helpers/db/exerciseHelper.ts`

**`packages/database/prisma/models/`:**
- Purpose: One Prisma model file per domain entity
- Models present: `user.prisma`, `exercise.prisma`, `workout-session.prisma`, `analysis-result.prisma`, `analysis-finding.prisma`, `body-metric.prisma`, `user-goal.prisma`, `user-milestone.prisma`, `milestone-definition.prisma`

**`packages/common/src/validations/`:**
- Purpose: Single source of truth for input validation schemas used by both API and native client
- Key files: `auth.ts` (loginSchema, registerSchema), `workoutSession.ts` (createWorkoutSessionSchema)

**`apps/native/app/`:**
- Purpose: Expo Router file-system routing
- `(auth)/` group — unauthenticated screens: `login.tsx`, `register.tsx`
- `(main)/(tabs)/` group — authenticated tab screens: `index.tsx` (Home), `settings.tsx`

## Key File Locations

**Entry Points:**
- `apps/api/src/index.ts`: API server bootstrap
- `apps/native/app/_layout.tsx`: Native app root layout
- `apps/web/app/layout.tsx`: Web app root layout

**Configuration:**
- `apps/api/src/config/env.ts`: API env schema and typed export
- `turbo.json`: Monorepo task pipeline
- `docker-compose.yaml`: Local development databases

**Core Logic:**
- `apps/api/src/services/userService.ts`: User auth logic (register, login)
- `apps/api/src/services/workoutSessionService.ts`: Session creation and listing
- `apps/api/src/services/exerciseService.ts`: Exercise catalog queries
- `packages/database/src/prisma.ts`: Prisma client lifecycle management

**Testing:**
- `apps/api/tests/integration/helpers/testSetup.ts`: Integration test setup/teardown
- `apps/api/vitest.config.ts`: Vitest configuration

## Naming Conventions

**Files (API):**
- Routes: camelCase resource name — `user.ts`, `session.ts`, `exercise.ts`
- Controllers: camelCase resource name — `user.ts`, `workoutSession.ts`
- Services: camelCase + `Service` suffix — `userService.ts`, `workoutSessionService.ts`
- Errors: PascalCase class name — `NotFoundError.ts`, `ApiError.ts`

**Files (Packages):**
- Prisma models: kebab-case — `workout-session.prisma`, `analysis-finding.prisma`
- UI components: PascalCase — `AuthInput.tsx`, `ScreenHeader.tsx`

**Directories:**
- Apps use flat camelCase directories for logical groupings: `controllers/`, `services/`, `middlewares/`
- Native routes use Expo Router parenthesised group convention: `(auth)/`, `(main)/(tabs)/`

## Where to Add New Code

**New API Resource (e.g. `programs`):**
1. Schema: `packages/common/src/validations/program.ts` + export from `packages/common/src/index.ts`
2. Prisma model: `packages/database/prisma/models/program.prisma`
3. Service: `apps/api/src/services/programService.ts` — extend `class ProgramService`, export singleton
4. Controller: `apps/api/src/controllers/program.ts` — named exports wrapped with `asyncHandler`
5. Route: `apps/api/src/routes/program.ts` — register schemas + middleware + controller
6. Mount: `apps/api/src/routes/index.ts` — `router.use("/programs", programRoutes)`
7. Tests: `apps/api/tests/integration/programs/` + builder in `tests/integration/builders/`

**New Custom Error:**
- Add to `apps/api/src/errors/` extending `ApiError` with the appropriate `StatusCodes.*` value

**New Shared UI Component:**
- Add to `packages/ui/src/` (or `packages/ui/src/auth/` if auth-related)
- Export from `packages/ui/src/index.tsx`

**New Native Screen:**
- Place under `apps/native/app/(main)/` for authenticated screens or `apps/native/app/(auth)/` for unauthenticated screens
- App-specific components go in `apps/native/src/components/`

**New Context/State:**
- `apps/native/src/context/` — follow `ThemeContext.tsx` pattern (createContext + Provider + custom hook)

**Utilities:**
- API shared helpers: `apps/api/src/utils/`
- Shared constants/messages: `packages/common/src/constants/`

## Special Directories

**`packages/database/generated/prisma/`:**
- Purpose: Prisma-generated TypeScript client
- Generated: Yes (by `prisma generate` / `db:generate` turbo task)
- Committed: Yes (checked in to avoid generation step on every clone)

**`apps/api/dist/`**, **`packages/*/dist/`**, **`apps/web/.next/`:**
- Purpose: Build output
- Generated: Yes
- Committed: No (gitignored)

**`.turbo/`:**
- Purpose: Turborepo task cache
- Generated: Yes
- Committed: No

**`apps/native/.expo/`:**
- Purpose: Expo build cache
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-03-21*
