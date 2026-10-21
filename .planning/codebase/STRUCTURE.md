# Codebase Structure

**Analysis Date:** 2026-10-21

## Directory Layout

```
cali-ai/
├── apps/
│   ├── api/                    # Express 5 REST API (TypeScript, ESM, tsup build)
│   │   ├── src/                # Application source
│   │   ├── tests/              # Vitest: unit/ and integration/ projects
│   │   ├── vitest.config.ts    # Two projects: unit, integration
│   │   └── tsup.config.ts      # Single entry: src/index.ts
│   └── native/                 # Expo SDK 54 app (Expo Router, custom dev build)
│       ├── app/                # File-based routes (Expo Router)
│       ├── src/               # Non-route app code (api, hooks, components, ...)
│       └── index.js            # Expo entry
├── packages/
│   ├── database/               # @repo/db: Prisma 7 schema, generated client, connection singleton
│   │   ├── prisma/             # schema.prisma, models/, enums.prisma, migrations/, seed.ts
│   │   └── src/                # prisma.ts, index.ts
│   ├── common/                 # @repo/common: Zod schemas and shared types
│   │   └── src/validations/    # One file per resource
│   ├── ui/                     # @repo/ui: React Native component library
│   │   └── src/                # Shared components, auth/ widgets
│   ├── eslint-config/          # Shared ESLint flat-config builder
│   └── typescript-config/      # Shared tsconfig bases (base, node, react-native-library)
├── docs/                       # architecture.md, data-model.md, features.md, vision.md
├── .planning/                  # GSD planning docs (PROJECT, ROADMAP, STATE, REQUIREMENTS, research/, codebase/)
├── .claude/                    # Claude Code commands and skills
├── .github/workflows/          # ci.yml
├── docker-compose.yaml         # Local Postgres (dev :5434, test :5433) and Redis
├── turbo.json                  # Turborepo task graph
├── knip.ts                     # Unused deps/exports checks (root-level)
├── eslint.config.mjs           # Root ESLint flat config
└── package.json                # Yarn Classic workspaces root
```

## Directory Purposes

### `apps/api/src/`

**`apps/api/src/index.ts`:** Process entry. Connects Prisma, listens, registers shutdown.

**`apps/api/src/app.ts`:** `createApp()` factory (middleware stack and `/api` mount). Imported by tests.

**`apps/api/src/config/`:**
- Purpose: Environment and constants.
- Contains: `env.ts` (Zod env schema, single `env` object), `constants.ts` (`VIDEO_ANALYSIS_WORKER_CONCURRENCY`).
- Rule: Add env vars here only, and also add them to `apps/api/tests/unit/helpers/unitEnv.ts`.

**`apps/api/src/routes/`:**
- Purpose: Route definitions with middleware chains.
- Contains: `index.ts` (aggregator), one file per resource: `auth.ts`, `user.ts`, `exercise.ts`, `workout.ts`, `workoutSession.ts`, `health.ts`, `openapi.ts`.
- Mount points: `/api/auth`, `/api/users`, `/api/exercises`, `/api/workouts`, `/api/workout-sessions`, `/api/health`.

**`apps/api/src/controllers/`:**
- Purpose: HTTP adapters. One file per resource, named `auth.ts`, `user.ts`, `exercise.ts`, `workout.ts`, `workoutSession.ts`.

**`apps/api/src/services/`:**
- Purpose: Business logic and Prisma access. One file per resource: `authService.ts`, `userService.ts`, `exerciseService.ts`, `workoutService.ts`, `workoutSessionService.ts`, `refreshTokenService.ts`.

**`apps/api/src/middlewares/`:**
- `auth/`: `authentication.ts` (`authenticateToken`), `optionalAuth.ts`, `authorization.ts` (`authorize`, not mounted), barrel `index.ts`.
- Top-level: `validateSchema.ts`, `errorHandler.ts`, `authRateLimiter.ts`.

**`apps/api/src/errors/`:**
- Purpose: Typed HTTP errors. `ApiError.ts` (base) plus `BadRequestError.ts`, `UnauthorizedError.ts`, `ForbiddenError.ts`, `NotFoundError.ts`, `ConflictError.ts`, `InternalError.ts`, `ServiceUnavailableError.ts`; barrel `index.ts`.

**`apps/api/src/lib/`:**
- Infrastructure singletons: `logger.ts` (pino), `redis.ts` (ioredis), `queue.ts` (BullMQ `video-analysis` queue, scaffold), `r2.ts` (S3 client for Cloudflare R2), `shutdown.ts` (process signal handling).

**`apps/api/src/utils/`:**
- Small pure helpers, each in its own file: `pagination.ts` (`lookAheadTake`, `paginate`), `parseDate.ts` (`parseOptionalDate`), `normalizeString.ts`, `getUserIdByUuid.ts`, `requireUserUuid.ts`, `generateJwtToken.ts`, `generateRefreshToken.ts`, `prismaErrorCodes.ts`, `toError.ts`, `zodErrorMessage.ts`.

**`apps/api/src/types/`:**
- `express.d.ts` (augments `Request` with `user`), `myJwtPayload.ts`.

**`apps/api/src/openapi/`:**
- Purpose: OpenAPI generation via `@asteasolutions/zod-to-openapi`.
- Contains: `registry.ts` (`OpenAPIRegistry`), `extend.ts` (imported first by `app.ts`), `schemas.ts` (presentation metadata, `.openapi()` calls live here, not in `@repo/common`), `spec.ts`, `paths/*.ts` (one per resource).
- Note: `paths/workoutSessions.ts` documents `/workout-sessions`.

### `apps/api/tests/`

- `globalSetup.ts`, `setup.ts`: Integration project setup (migrations; `NODE_ENV=test` and `_test` database assertion).
- `unit/`: Mirrors `src/`: `config/`, `controllers/`, `errors/`, `lib/`, `middlewares/`, `services/`, `utils/`. Shared helpers in `unit/helpers/` (`prismaMock.ts`, `expressMocks.ts`, `unitEnv.ts`).
- `integration/`: Supertest suites grouped by resource (`auth/`, `users/`, `workouts/`, `workoutSessions/`, `exercises/`), with `builders/`, `helpers/db/`, `helpers/requestSender/`, and `testSetup.ts`.

### `apps/native/`

**`apps/native/app/`:** Expo Router routes. Files here define URLs; keep logic in `src/`.
- `_layout.tsx`: Root providers (`QueryClientProvider`, `AuthProvider`, `ThemeProvider`, `SafeAreaProvider`, `GestureHandlerRootView`) and root `Stack`.
- `(auth)/`: `_layout.tsx`, `login.tsx`, `register.tsx`.
- `(main)/`: `_layout.tsx` (Stack with headers), `(tabs)/` (`_layout.tsx`, `index.tsx` home, `workouts.tsx`, `settings.tsx`), and detail screens `profile.tsx`, `profile-edit.tsx`, `exercise-catalog.tsx`, `exercise-detail.tsx`, `workout-builder.tsx`, `workout-detail.tsx`, `workout-execute.tsx`.

**`apps/native/src/`:**
- `api/`: `client.ts` (fetch wrapper), `tokenStore.ts`, `errors.ts` (`ApiError`), `keys.ts` (query key factories), `index.ts` (barrel), `endpoints/` (`auth.ts`, `user.ts`, `workouts.ts`, `exercises.ts`, `index.ts`).
- `hooks/`: Feature hooks at the top level (`useWorkoutExecution.ts`, `useWorkoutBuilder.ts`, `useLogin.ts`, `useRegister.ts`, `useLogout.ts`, `useProfileEdit.ts`, `useNotificationReminder.ts`, `useCountdown.ts`), plus `queries/` (`useWorkouts.ts`, `useWorkoutDetail.ts`, `useExercises.ts`, `useExerciseDetail.ts`, `useProfile.ts`) and `mutations/` (`useCreateWorkout.ts`, `useUpdateWorkout.ts`, `useDeleteWorkout.ts`, `useStartWorkout.ts`).
- `components/`: Reusable presentational components (e.g. `WorkoutCard.tsx`, `ExerciseCard.tsx`, `RestTimer.tsx`, `AvatarPickerModal.tsx`, `ReminderPicker.tsx`).
- `context/`: `AuthContext.tsx`, `ThemeContext.tsx`.
- `state/`: `pickedExerciseStore.ts` (module-level store).
- `theme/`: `colors.ts` (theme tokens).
- `constants/`: `routes.ts` (API path builders as `*_ROUTES` objects).
- `types/`: Local UI/form-state types only (`reminder.ts`, `user.ts`, `images.d.ts`). Do not add API response types here.

**Path aliases:** `@src/*` maps to `apps/native/src/*` (used throughout `app/` and `src/`).

### `packages/database/`

- `prisma/schema.prisma`: Generator (`prisma-client`, output `../generated/prisma`) and datasource only.
- `prisma/models/*.prisma`: One model per file (`user.prisma`, `exercise.prisma`, `workout.prisma` containing `Workout`, `WorkoutExercise`, `WorkoutLog`, `workout-session.prisma`, `analysis-result.prisma`, `analysis-finding.prisma`, `refresh-token.prisma`, `user-goal.prisma`, `user-milestone.prisma`, `milestone-definition.prisma`, `body-metric.prisma`).
- `prisma/enums.prisma`: All enums (`Role`, `SessionStatus`, `ExerciseType`, `FindingType`, `FindingSeverity`, ...).
- `prisma/migrations/`: Timestamped SQL migrations. Latest: `20260522174849_add_refresh_tokens`.
- `prisma/seed.ts`: Exercise and dev seed data.
- `prisma.config.ts`: Prisma 7 config.
- `src/prisma.ts`: `connectPrisma`, `getPrismaClient`, `disconnectPrisma` (singleton).
- `src/index.ts`: Public surface, re-exports the client and enums.
- `generated/prisma/`: Generated client. Gitignored; regenerate with `yarn workspace @repo/db db:generate`.

### `packages/common/`

- `src/validations/`: One file per resource: `auth.ts`, `user.ts`, `workout.ts`, `workoutSession.ts`, `exercise.ts`, `pagination.ts`.
- `src/constants/messages.ts`: Shared user-facing message strings.
- `src/index.ts`: Barrel re-exporting every validation file. Add new validation files here.

### `packages/ui/`

- `src/`: `ScreenHeader.tsx`, `SwitchRow.tsx`, `index.tsx` (barrel), `auth/` (`AuthHeader.tsx`, `AuthInput.tsx`, `AuthFooter.tsx`, `AuthImageHeader.tsx`, `AuthOrDivider.tsx`, `AuthRememberRow.tsx`, `GoogleSignInButton.tsx`).

### `docs/`

- `architecture.md`: Target architecture (on-device pose and keypoints). Mixes implemented and planned work; check `ARCHITECTURE.md` in `.planning/codebase/` for what is implemented.
- `data-model.md`, `features.md`, `vision.md`.

## Key File Locations

**Entry Points:**
- `apps/api/src/index.ts`: API process start.
- `apps/api/src/app.ts`: Express app factory.
- `apps/native/index.js`: Expo entry.
- `apps/native/app/_layout.tsx`: Native root layout.

**Configuration:**
- `apps/api/src/config/env.ts`: API env schema (only place `process.env` is read in API).
- `apps/native/app.json`, `apps/native/eas.json`, `apps/native/metro.config.js`, `apps/native/babel.config.js`: Expo, EAS and bundler config.
- `apps/api/tsup.config.ts`, `apps/api/vitest.config.ts`, `apps/api/tsconfig.json`: API build and test config.
- `packages/database/prisma.config.ts`: Prisma config.
- `turbo.json`, `knip.ts`, `.syncpackrc.json`, `.prettierrc`, `eslint.config.mjs`: Monorepo tooling.
- `apps/api/.env.example`, `packages/database/.env.example`: Env templates (values are never committed).

**Core Logic:**
- `apps/api/src/services/*.ts`: Business logic.
- `apps/api/src/middlewares/auth/authentication.ts`: JWT verification.
- `packages/common/src/validations/*.ts`: API contracts.
- `apps/native/src/api/client.ts`: Native HTTP client.
- `apps/native/src/hooks/useWorkoutExecution.ts`: Set/rest state machine for the workout screen.

**Testing:**
- `apps/api/tests/unit/`: No DB, no network. Mirrors `src/`.
- `apps/api/tests/integration/`: Real Postgres on `:5433`.
- `apps/native/`: No test directory or test runner configured yet.

## Naming Conventions

**Files (API):**
- Services, controllers, routes, middleware: camelCase `resourceService.ts`, `workoutSession.ts`. Route file name matches the resource (`workoutSession.ts`) but the URL uses kebab-case (`/workout-sessions`).
- Errors: PascalCase `NotFoundError.ts`, one class per file.
- Utils: camelCase verb or noun (`parseDate.ts`, `getUserIdByUuid.ts`).
- Tests: `*.test.ts`, under `tests/` only.

**Files (native):**
- Routes under `app/`: kebab-case (`workout-execute.tsx`, `exercise-detail.tsx`), as Expo Router requires.
- Components: PascalCase `WorkoutCard.tsx`.
- Hooks: `useXxx.ts`, grouped into `queries/` and `mutations/` where they wrap TanStack Query.
- Route-group folders: `(auth)`, `(main)`, `(tabs)`.

**Files (packages):**
- Prisma models: kebab-case `workout-session.prisma`, one model per file.
- Migrations: `YYYYMMDDHHMMSS_snake_case_name/migration.sql`.
- Validations: camelCase resource name, e.g. `workoutSession.ts`.

**Directories:**
- API: lowercase single words (`controllers`, `services`, `middlewares`).
- Native `src/`: lowercase single words; `queries/` and `mutations/` nested under `hooks/`.

**Identifiers:**
- Functions and variables: camelCase. Classes: PascalCase, used only for services and errors.
- Zod schemas: `camelCaseSchema` (e.g. `createWorkoutSessionSchema`). Inferred types: `XxxValues` (e.g. `CreateWorkoutSessionValues`).
- Enums: `SCREAMING_SNAKE` values (`PENDING`, `PROCESSING`).
- Express routers: `const router: Router = Router();`, exported as default.

## Where to Add New Code

**New API resource (CRUD endpoint):**
1. Zod schema: `packages/common/src/validations/<resource>.ts`, then re-export from `packages/common/src/index.ts`.
2. Prisma model: `packages/database/prisma/models/<model>.prisma`, enums in `enums.prisma`, then `yarn workspace @repo/db db:generate` and a migration.
3. Service: `apps/api/src/services/<resource>Service.ts` (class + `export default new ...`).
4. Controller: `apps/api/src/controllers/<resource>.ts`.
5. Route: `apps/api/src/routes/<resource>.ts`, registered in `apps/api/src/routes/index.ts`.
6. OpenAPI: presentation metadata in `apps/api/src/openapi/schemas.ts`, path registration in `apps/api/src/openapi/paths/<resource>.ts`.
7. Tests: unit under `apps/api/tests/unit/{services,controllers}/`, integration under `apps/api/tests/integration/<resource>/`, builders in `tests/integration/builders/`.

**New API env var:** Add to `envSchema` and to `env` in `apps/api/src/config/env.ts`, plus `apps/api/tests/unit/helpers/unitEnv.ts`, and `apps/api/.env.example`.

**New shared utility (API):** `apps/api/src/utils/<name>.ts`, with a test in `apps/api/tests/unit/utils/<name>.test.ts`.

**New typed error:** `apps/api/src/errors/<Name>Error.ts` extending `ApiError`, exported from `apps/api/src/errors/index.ts`.

**New background job (planned pipeline):**
- Producer: called from a service in `apps/api/src/services/`, using the queue exported from `apps/api/src/lib/queue.ts`. Replace the scaffold `VideoAnalysisJobData` contract with the keypoint-based payload.
- Consumer: a new entry file such as `apps/api/src/worker/index.ts` (no such directory yet), added to `apps/api/tsup.config.ts` `entry`. Derive `logger.child({ jobId, sessionId })` per job.
- Pure analysis logic (metrics, exercise definitions): `packages/common/src/` in a new folder (e.g. `analysis/`), so both the worker and tests import it without I/O.

**New native screen:**
- Route file: `apps/native/app/(main)/<kebab-name>.tsx` (register its `Stack.Screen` in `apps/native/app/(main)/_layout.tsx` for a custom title or header).
- Logic: `apps/native/src/hooks/<useName>.ts`; server data via `hooks/queries/` or `hooks/mutations/`.
- Components: `apps/native/src/components/<Name>.tsx`.
- API call: add to `apps/native/src/api/endpoints/<resource>.ts`, path in `apps/native/src/constants/routes.ts`, key in `apps/native/src/api/keys.ts`. Import response types from `@repo/common`.

**New native tab:** `apps/native/app/(main)/(tabs)/<name>.tsx` and a `Tabs.Screen` entry in `apps/native/app/(main)/(tabs)/_layout.tsx`.

**New camera or pose module (planned):** `apps/native/src/` under a new `camera/` or `pose/` folder. Native modules require the custom dev build (`expo-dev-client`), run Expo commands from `apps/native`.

**Shared UI primitive:** `packages/ui/src/<Name>.tsx`, exported from `packages/ui/src/index.tsx`. Shared runtime libs (`react`, `react-native`, `@expo/vector-icons`) are peer and dev dependencies.

**Shared Prisma helper:** Never create a second `PrismaClient`. Use `getPrismaClient` from `@repo/db`.

## Special Directories

**`packages/database/generated/`:**
- Purpose: Prisma client output.
- Generated: Yes.
- Committed: No.

**`packages/database/prisma/migrations/`:**
- Purpose: SQL migration history.
- Generated: Partly (by `prisma migrate dev`).
- Committed: Yes.

**`apps/api/dist/`:**
- Purpose: `tsup` build output.
- Generated: Yes.
- Committed: No (`apps/api/.gitignore`).

**`apps/native/.expo-shared/`:**
- Purpose: Expo shared asset metadata.
- Generated: Yes.
- Committed: Yes (listed in git).

**`.claude/`:**
- Purpose: Claude Code commands and skills for this repo, including Expo and React Native guidance.
- Generated: No.
- Committed: Yes.

**`.planning/`:**
- Purpose: GSD planning state. `codebase/` holds these mapping documents. `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` are updated only by GSD commands or in the same branch as the work they track.
- Generated: Partly.
- Committed: Yes.

---

*Structure analysis: 2026-10-21*
