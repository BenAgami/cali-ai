# Coding Conventions

**Analysis Date:** 2026-10-21

## Naming Patterns

**Files:**
- API source files are camelCase, one primary export per file: `apps/api/src/services/exerciseService.ts`, `apps/api/src/controllers/workoutSession.ts`, `apps/api/src/middlewares/validateSchema.ts`
- Error classes are PascalCase files that default-export the class: `apps/api/src/errors/NotFoundError.ts`, re-exported from `apps/api/src/errors/index.ts`
- Native components are PascalCase `.tsx` files with a default export: `apps/native/src/components/Stepper.tsx`, `apps/native/src/components/WorkoutCard.tsx`
- Native hooks are `use`-prefixed camelCase `.ts` files, grouped by kind: `apps/native/src/hooks/queries/useWorkouts.ts`, `apps/native/src/hooks/mutations/useCreateWorkout.ts`
- Expo Router screens are kebab-case route files: `apps/native/app/(main)/workout-builder.tsx`, `apps/native/app/(main)/exercise-detail.tsx`
- Shared Zod schemas are camelCase per domain: `packages/common/src/validations/workoutSession.ts`

**Functions:**
- camelCase everywhere. API controllers and utilities are `const` arrow functions: `export const listExercises = async (...) => {}` in `apps/api/src/controllers/exercise.ts`
- Utilities that are the only export are default exports: `apps/api/src/utils/requireUserUuid.ts`, `apps/api/src/utils/generateJwtToken.ts`. Multi-export utility files use named exports: `apps/api/src/utils/pagination.ts` (`lookAheadTake`, `paginate`), `apps/api/src/utils/toError.ts` (`toError`)
- Services are classes with a `private get prisma()` getter, exported both as the class and as a default singleton instance:
  ```typescript
  // apps/api/src/services/exerciseService.ts
  export class ExerciseService {
    private get prisma() {
      return getPrismaClient();
    }
    // ...
  }
  export default new ExerciseService();
  ```
- Private static class constants use `private static readonly` in UPPER_SNAKE_CASE: `AuthService.BCRYPT_ROUNDS`, `AuthService.MAX_USERNAME_ATTEMPTS` in `apps/api/src/services/authService.ts`
- Native hooks are named `useX` and return the React Query result directly: `apps/native/src/hooks/queries/useWorkouts.ts`
- React components are typed as `React.FC<XProps>` with an exported `interface XProps` in the same file: `apps/native/src/components/Stepper.tsx`

**Variables:**
- camelCase; module-level constants UPPER_SNAKE_CASE: `const PAGE_SIZE = 50;` (`apps/native/src/hooks/queries/useWorkouts.ts`), `const TIMEOUT_MS = 10_000;` (`apps/native/src/api/client.ts`)
- Boolean flags are prefixed with `should`, `is`, or `has` in code paths that matter: `shouldIncludeInactive` in `apps/api/src/controllers/exercise.ts`
- Unused parameters and variables are prefixed with `_` (enforced by ESLint, see below): `_next` in `apps/api/src/middlewares/errorHandler.ts`, `[_label, user]` in tests

**Types:**
- Request-shape types are local `type` aliases placed directly above the handler: `type ListExercisesQuery = {...}` in `apps/api/src/controllers/exercise.ts`
- Input shapes for services are local `type XInput` (`ListExercisesInput` in `apps/api/src/services/exerciseService.ts`)
- Validated request payloads are inferred from Zod, never hand-written: `export type CreateWorkoutSessionValues = z.infer<typeof createWorkoutSessionSchema>` in `packages/common/src/validations/workoutSession.ts`
- Native component prop interfaces use `interface` with a `Props` suffix; other native types use `type` (`apps/native/src/types/user.ts`)
- Env-level types are derived from schemas in `apps/api/src/config/env.ts`; do not redeclare them

## Code Style

**Formatting:**
- Prettier is the only formatter. Root config: `.prettierrc`
  - `printWidth: 80`, `tabWidth: 2`, `useTabs: false`
  - `semi: true`, `singleQuote: false` (double quotes), `trailingComma: "all"`
  - `arrowParens: "always"`, `endOfLine: "lf"`, `quoteProps: "as-needed"`
- Enforced in CI with `yarn format:check`. Run `yarn format` before pushing. Test files are included.

**Linting:**
- ESLint 9 flat config. Root base config: `eslint.config.mjs`, which composes `baseRules` and `sharedIgnores` from `packages/eslint-config/src/index.ts`
- `baseRules` = `js.configs.recommended` + `tseslint.configs.recommendedTypeChecked`, so type-aware `no-unsafe-*`, `no-floating-promises`, and `unbound-method` rules are active
- `@typescript-eslint/no-unused-vars` is `warn` with `^_` ignore patterns for args and vars
- `apps/api/eslint.config.mjs` sets `projectService: true` and Node globals. The `tests/**/*.ts` override turns off `no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-argument`, `no-unsafe-call`, `no-unsafe-return`, and `unbound-method`
- `apps/native/eslint.config.mjs` adds `eslint-plugin-react-hooks` (`recommended-latest`) and browser globals plus `__DEV__`
- Inline suppression is rare. The only one in the repo is `// eslint-disable-next-line react-hooks/exhaustive-deps` in `apps/native/src/hooks/useWorkoutExecution.ts`. Do not add new suppressions without a comment explaining why
- Run `yarn lint` and `yarn check-types` from the root (Turborepo) or per workspace

**Dead code and exports:**
- Knip (`knip.ts` at root) fails CI on unused files, dependencies, and exports. Delete dead code rather than keeping it. Mark deliberately unused exports `/** @public */`
- Every workspace must declare the dependencies it imports. Do not rely on hoisting
- syncpack (`.syncpackrc.json`) requires identical version ranges across workspaces. Internal `@repo/*` packages are referenced as `*`

## Import Organization

**Order (observed in API files):**
1. Third-party packages (`express`, `zod`, `http-status-codes`, `bcrypt`)
2. Internal workspace packages (`@repo/db`, `@repo/common`)
3. Relative imports to `../errors`, `../services/...`, `../utils/...`, separated by a blank line between groups
4. Relative siblings (`./refreshTokenService`) last

Example from `apps/api/src/services/authService.ts`:
```typescript
import bcrypt from "bcrypt";

import { getPrismaClient } from "@repo/db";
import { RegisterValues, LoginValues } from "@repo/common";

import { ConflictError, UnauthorizedError } from "../errors";

import generateJwtToken from "../utils/generateJwtToken";
import { normalizeString } from "../utils/normalizeString";

import refreshTokenService from "./refreshTokenService";
```

**Native order:** React and React Native first, then context/hooks/state, then `@repo/*`, then `@src/*` alias imports.

**Path Aliases:**
- `@src/*` in `apps/native` resolves to `apps/native/src/*` (for example `@src/context/AuthContext`, `@src/api`)
- No path aliases in `apps/api`; use relative imports
- Workspace packages: `@repo/db`, `@repo/common`, `@repo/ui`, `@repo/eslint-config`

**Barrel files:**
- `apps/api/src/errors/index.ts` and `apps/native/src/api/endpoints/index.ts` are barrels. Keep barrels to re-exports only
- `apps/api/src/utils/` does not use a barrel; import each utility by file path

## Error Handling

**API - throw typed errors, never respond inline:**
- Throw an `ApiError` subclass from `apps/api/src/errors/`: `NotFoundError`, `ConflictError`, `UnauthorizedError`, `ForbiddenError`, `BadRequestError`, `InternalError`, `ServiceUnavailableError`
- `apps/api/src/errors/ApiError.ts` carries `status` and `statusCode`, and sets `name` from `new.target.name`
- `apps/api/src/middlewares/errorHandler.ts` maps the error to the JSON envelope. Controllers and services do not catch these errors
- Controllers are plain `async` functions. Do not wrap them in try/catch or an `asyncWrapper`. Express 5 forwards rejected promises to `next`
  ```typescript
  // apps/api/src/controllers/exercise.ts
  if (shouldIncludeInactive && req.user?.role !== Role.ADMIN) {
    throw new ForbiddenError("Admin access required to view inactive exercises");
  }
  ```
- Missing rows are signaled by throwing, not returning null: `if (!exercise) throw new NotFoundError("Exercise not found");` in `apps/api/src/services/exerciseService.ts`

**API - Prisma errors:**
- Map Prisma error codes through helpers in `apps/api/src/utils/prismaErrorCodes.ts` (`PrismaErrorCode`, `isPrismaKnownRequestError`). Do not compare raw `code` strings in services

**API - catch parameters:**
- `catch (error)` bindings are `unknown`. Normalize with `toError` from `apps/api/src/utils/toError.ts` before logging:
  ```typescript
  } catch (error) {
    logger.error({ err: toError(error) }, "Failed to process job");
  }
  ```

**Validation errors:**
- `apps/api/src/middlewares/validateSchema.ts` returns 400 with `{ success: false, message: "Validation Error", details }` for `ZodError`, formatted by `apps/api/src/utils/zodErrorMessage.ts`
- Shared user-facing validation strings live in `packages/common/src/constants/messages.ts` (`AUTH_MESSAGES`)

**Native - error handling:**
- All HTTP calls go through `apps/native/src/api/client.ts`, which throws `ApiError` from `apps/native/src/api/errors.ts` with `status` and a user-facing message
- Fallback messages per status live in `FALLBACK_MESSAGES` in `apps/native/src/api/client.ts`. Add new status copy there, not in components
- Components render `error.message` from React Query; do not parse status codes in UI code

## Response Envelope

**API responses are always wrapped:**
- Success: `{ success: true, message: "...", data: ... }`
- Failure: `{ success: false, message: "..." }`, plus `code` and `details` from `errorHandler`
- Use a human-readable sentence for `message`, for example `"Exercises retrieved successfully"` in `apps/api/src/controllers/exercise.ts`
- Status codes come from `http-status-codes` `StatusCodes` enum, never numeric literals: `res.status(StatusCodes.CREATED)`

## Logging

**API framework:** `pino` singleton at `apps/api/src/lib/logger.ts`, with `pino-http` mounted in every environment (`autoLogging` disabled under `test`). `apps/api/src/config/env.ts` is the only exception that uses `console.error`, because it runs before the logger can be constructed.

**Patterns:**
- Log errors as `{ err: error }`, never by interpolating `error.message` into the message string
  ```typescript
  logger.error({ err: toError(error) }, "Unhandled server error");
  ```
- 5xx errors are always logged. Lower-severity errors use `logger.debug` outside production (`apps/api/src/middlewares/errorHandler.ts`)
- Log messages are short imperative or descriptive sentences in sentence case. Put structured data in the first argument object
- Redaction paths for tokens, passwords, and authorization headers are configured centrally in `apps/api/src/lib/logger.ts`. Do not add per-call redaction
- Outside HTTP request context (BullMQ worker), derive a child once per job and log through it: `const jobLogger = logger.child({ jobId, sessionId })`. Do not log through the bare singleton from job code
- Every log line already carries `service` and `env` through `base`. Do not add them manually
- Never call `console.log` or `console.error` in `apps/api/src`

**Native:** no logging framework is configured. `console` appears only in a few context files (`apps/native/src/context/AuthContext.tsx`, `apps/native/src/context/ThemeContext.tsx`). Do not add new `console` calls.

## Comments

**When to Comment:**
- Document each controller and route with a JSDoc block that names the method and route, for example `@route GET /api/exercises` in `apps/api/src/controllers/exercise.ts`
- Document each route file's handlers with a `/** METHOD / Description */` block, see `apps/api/src/routes/workoutSession.ts`
- Explain non-obvious rules (security, ordering, normalization) with a short inline comment. Do not restate the code
- Test files may carry a comment when a test pins behavior that is arguably wrong. Say so explicitly (CLAUDE.md requirement)

**JSDoc/TSDoc:**
- Used on exported controllers and service-level public behavior
- Not used for type-only declarations, which are self-describing via Zod inference

## Function Design

**Size:**
- Controllers are short: parse inputs, delegate to a service, respond. Typical body is under 25 lines (see `apps/api/src/controllers/exercise.ts`)
- Services hold the business logic and are split into one public method per use case plus private helpers, for example `private async getExerciseByCode` in `apps/api/src/services/workoutSessionService.ts`

**Parameters:**
- Use a single input object once a function takes more than two arguments: `listExercises({ limit, offset, includeInactive })`
- Pass the authenticated user's UUID (`req.user.sub`) into services, not the whole request
- Read the current user with `requireUserUuid(req, res)` from `apps/api/src/utils/requireUserUuid.ts` when the route is authenticated

**Return values:**
- Services return plain domain objects or the shared paginated shape from `paginate` (`apps/api/src/utils/pagination.ts`)
- Controllers return nothing; they call `res.status(...).json(...)`

**Pagination:**
- Always use `lookAheadTake(limit)` for `take` and `paginate(rows, limit, offset)` for the result. Do not hand-roll `hasMore` logic
- `limit` defaults to 20 in controllers; `offset` defaults to 0

**Date parsing:**
- Use `parseOptionalDate` from `apps/api/src/utils/parseDate.ts` for optional ISO dates from request input

## Module Design

**Exports:**
- Services: class export plus `export default new ServiceName()` singleton
- Controllers: named `export const` per handler
- Middlewares: default export per file (`validateSchema`, `errorHandler`, `authorize`). The auth middleware directory re-exports them by name through the barrel `apps/api/src/middlewares/auth/index.ts`
- Route modules: `export default router` where `router: Router`
- Shared types: named exports from `packages/common/src/index.ts`

**Barrel Files:**
- Used for error classes (`apps/api/src/errors/index.ts`), auth middleware (`apps/api/src/middlewares/auth/index.ts`), and common package entrypoint (`packages/common/src/index.ts`)
- Not used for utilities or services

## Database Access

- The Prisma client is a singleton exported from `packages/database/src/index.ts`. Obtain it with `getPrismaClient()`
- Never call `new PrismaClient()` outside `packages/database/src/prisma.ts` and the seed script
- Only services touch Prisma. Controllers and routes never import from `@repo/db` for queries (importing `Role` and enums is allowed)
- Use `include`/`select` explicitly for response shapes (see `apps/api/src/services/workoutSessionService.ts`)
- Persist timestamps and IDs through Prisma defaults; UUIDs are the public identifier, numeric IDs stay internal (`getUserIdByUuid` in `apps/api/src/utils/getUserIdByUuid.ts`)

## Validation and Shared Schemas

- Validate every request body, query, and params in route middleware: `validateSchema(z.object({ body: someSchema }))` in `apps/api/src/routes/workoutSession.ts`
- Route-local query schemas (for example `listWorkoutSessionsQuerySchema`) stay in the route file. Body schemas live in `packages/common/src/validations/`
- Response shapes used by both API and native are defined once in `packages/common/src/validations/`. Keep `@repo/common` free of `.openapi()` calls. Add OpenAPI presentation metadata at `apps/api/src/openapi/schemas.ts`
- `apps/native/src/types/` holds only local UI or form-state shapes. Do not duplicate API response types there
- Environment variables are validated in `apps/api/src/config/env.ts`. Never read `process.env` elsewhere in the API. The native app reads `process.env.EXPO_PUBLIC_API_BASE_URL` in `apps/native/src/api/client.ts` and throws at import time when it is missing

## Native App Conventions

**Components:**
- Function components typed as `React.FC<Props>`, exported as default. Styling uses `StyleSheet.create` plus theme tokens from `useTheme()` (`apps/native/src/context/ThemeContext.tsx`), with colors from `apps/native/src/theme/colors.ts`
- Accessibility props (`accessibilityRole`, `accessibilityLabel`) are set on interactive elements, see `apps/native/src/components/Stepper.tsx`
- Shared primitives used across apps live in `packages/ui/src/` and are exported from `packages/ui/src/index.tsx`

**Data fetching:**
- TanStack React Query. Query keys come from factories in `apps/native/src/api/keys.ts` (`workoutKeys.lists()`, `workoutKeys.detail(id)`). Never inline a raw key array in a hook
- Queries are gated with `enabled: !!token` where auth is required (`apps/native/src/hooks/queries/useWorkouts.ts`)
- Mutations invalidate lists and seed detail caches in `onSuccess`, see `apps/native/src/hooks/mutations/useCreateWorkout.ts`
- API endpoint objects live in `apps/native/src/api/endpoints/` and are re-exported by `apps/native/src/api/index.ts`

**Routing:**
- Expo Router file-based routes. Route group `(auth)` for login and register; `(main)/(tabs)` for tab screens
- Route paths are centralized in `apps/native/src/constants/routes.ts`, and most navigation imports it. Some screens still push inline string literals, so prefer the constants when adding navigation

**State:**
- Server state through React Query. Auth state through `apps/native/src/context/AuthContext.tsx`. Ephemeral cross-screen selections through a small store like `apps/native/src/state/pickedExerciseStore.ts`

## Naming Consistency Watch

- The codebase is mid-migration: `workoutSession` code still carries video-era fields (`videoMeta`, `videoSizeBytes` as `bigint`, `videoDurationSec` in `apps/api/src/services/workoutSessionService.ts` and `packages/common/src/validations/workoutSession.ts`). The architecture has moved to on-device pose estimation with keypoint capture, which is not yet implemented in code. When touching these files, follow `docs/architecture.md` and `docs/data-model.md` for new names rather than extending the video-era fields

---

*Convention analysis: 2026-10-21*
