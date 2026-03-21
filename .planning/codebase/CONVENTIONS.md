# Coding Conventions

**Analysis Date:** 2026-03-21

## Naming Patterns

**Files:**
- Source files use camelCase for multi-word names: `userService.ts`, `asyncWrapper.ts`, `zodErrorMessage.ts`
- Error class files use PascalCase matching the class name: `ApiError.ts`, `NotFoundError.ts`, `BadRequestError.ts`
- Middleware files use camelCase: `errorHandler.ts`, `validateSchema.ts`, `authentication.ts`
- Prisma model schema files use kebab-case: `workout-session.prisma`, `analysis-finding.prisma`
- Test builder files use camelCase with `Builder` suffix: `registerUserBuilder.ts`, `exerciseBuilder.ts`
- Request sender helpers use camelCase with resource plural + `Requests` suffix: `authRequests.ts`, `exercisesRequests.ts`

**Functions:**
- Top-level exported functions use camelCase verbs: `registerUser`, `loginUser`, `getUserProfile`, `getMyUser`, `listExercises`, `getExerciseByCode`
- Private service helpers use camelCase verbs: `normalizeEmail`, `generateUniqueUsername`, `getUserIdByUuid`
- Factory/setup functions use camelCase verb phrases: `createApp`, `connectPrisma`, `getPrismaClient`, `setupIntegrationTest`

**Variables:**
- camelCase throughout: `userUuid`, `normalizedEmail`, `hashedPassword`, `exerciseCode`
- Unused parameters prefix with underscore: `_req`, `_next`, `_` (e.g., in middleware signatures)

**Types and Interfaces:**
- Types for local param shapes use PascalCase with descriptive suffix: `GetUserProfileParams`, `ListExercisesQuery`, `SignedPayload`
- DTO interfaces use PascalCase with `Dto` suffix: `RegisterUserDto`, `LoginUserDto`, `ExerciseDto`, `WorkoutSessionDto`
- Exported Zod-inferred types use PascalCase with `Values` suffix: `RegisterValues`, `LoginValues`, `CreateWorkoutSessionValues`

**Classes:**
- Service classes use PascalCase with `Service` suffix: `UserService`, `ExerciseService`, `WorkoutSessionService`
- Builder classes use PascalCase with `Builder` suffix: `RegisterUserBuilder`, `ExerciseBuilder`, `WorkoutSessionBuilder`
- Error classes use PascalCase with `Error` suffix: `ApiError`, `NotFoundError`, `ConflictError`, `UnauthorizedError`, `ForbiddenError`, `BadRequestError`, `InternalError`

**Constants:**
- Object constants use `SCREAMING_SNAKE_CASE`: `AUTH_MESSAGES`, `BCRYPT_ROUNDS`, `MAX_USERNAME_ATTEMPTS`

## Code Style

**Formatting:**
- Prettier is the formatter, configured at root via `format` script in `/package.json`
- Format command: `prettier --write "**/*.{ts,tsx,js,jsx,json,md}" --ignore-path .gitignore`
- No `.prettierrc` file found — Prettier defaults apply (2-space indentation, double quotes inferred from code)
- Trailing commas are used in multi-line arguments (visible in function definitions across all service files)

**Linting:**
- ESLint used in `apps/api` (script: `eslint . --ext .ts`)
- `apps/web` uses `next/core-web-vitals` ESLint config via `/apps/web/.eslintrc.json`
- No root-level `.eslintrc` — linting is per-app
- `no-console` rule is active: `console.log` calls require `// eslint-disable-next-line no-console` (see `packages/database/src/prisma.ts`)

**TypeScript:**
- Strict mode enabled via `packages/typescript-config/base.json`
- `isolatedModules: true`, `esModuleInterop: true`, `forceConsistentCasingInFileNames: true`
- Target `ES2022`, module `CommonJS` for the API (from `packages/typescript-config/node.json`)
- No unused locals/parameters enforcement (`noUnusedLocals: false`, `noUnusedParameters: false`)
- Vitest globals typed via `"types": ["node", "vitest/globals"]` in `apps/api/tsconfig.json`

## Import Organization

**Order (observed pattern in source files):**
1. Node built-ins or third-party packages (e.g., `express`, `bcrypt`, `jsonwebtoken`)
2. Internal monorepo packages (`@repo/common`, `@repo/db`)
3. Local application imports (errors, services, utils, middlewares, controllers)

Blank lines separate each group. No path alias used in the API — relative imports only within `apps/api/src/`. The native app uses `@src/` and `@assets/` path aliases (configured in `apps/native/tsconfig.json` / `babel.config.js`).

**Barrel Files:**
- `packages/common/src/index.ts` re-exports all validations via `export * from`
- `packages/ui/src/index.tsx` acts as the UI package barrel
- No barrel file at `apps/api/src/` — each module imports directly

## Error Handling

**Strategy:**
- Custom error class hierarchy rooted at `ApiError` (`apps/api/src/errors/ApiError.ts`)
- `ApiError` extends `Error` with `status` and `statusCode` fields, both set to the same value
- Subclasses inject their HTTP status code via `http-status-codes` `StatusCodes` enum:
  - `NotFoundError` → 404
  - `UnauthorizedError` → 401
  - `ForbiddenError` → 403
  - `ConflictError` → 409
  - `BadRequestError` → 400
  - `InternalError` → 500
- All async route handlers are wrapped with `asyncHandler` from `apps/api/src/utils/asyncWrapper.ts`, which forwards thrown errors to Express's `next(error)`
- Global error handler at `apps/api/src/middlewares/errorHandler.ts` reads `error.status` and `error.message`, returns `{ success: false, message }`

**Pattern for throwing errors in services:**
```typescript
if (!user) {
  throw new NotFoundError("User not found");
}
throw new ConflictError("User with this email already exists");
throw new UnauthorizedError("Invalid email or password");
```

**Pattern for inline auth guard in controllers (when middleware doesn't cover it):**
```typescript
const userUuid = req.user?.sub;
if (!userUuid) {
  return res.status(StatusCodes.UNAUTHORIZED).json({
    success: false,
    message: "Unauthorized access - user UUID is missing",
  });
}
```

## Response Shape

All API responses follow a consistent envelope:

**Success:**
```typescript
res.status(StatusCodes.CREATED).json({
  success: true,
  message: "Human-readable success message",
  data: { ... },
});
```

**Error (from errorHandler):**
```typescript
{ success: false, message: "Error message" }
```

**Validation Error (from validateSchema middleware):**
```typescript
{
  message: "Validation Error",
  details: [{ message: "body.field - Zod error message" }]
}
```

## Logging

**Framework:** `console.error` only (no structured logging library)

**Patterns:**
- `console.error(error)` in the global error handler for all unhandled errors
- `console.log` is suppressed by ESLint `no-console` rule; requires inline disable comments when intentionally used (e.g., database connection events in `packages/database/src/prisma.ts`)
- No request-level logging of business events; `morgan("dev")` handles HTTP request logging

## Comments

**When to Comment:**
- JSDoc on every controller function: `@route`, `@param`, `@returns` format
- JSDoc on public service methods: `@param`, `@returns` only (no `@route`)
- Single-line `// TODO:` comments for deferred enhancements (e.g., `// TODO: Enhanced Error Handling`, `// TODO: Enhanced Health Checks`)
- Inline route comments in router files: `/** GET / */`, `/** POST /register */`

**Example controller JSDoc:**
```typescript
/**
 * Register a new user
 * @route POST /api/users/register
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Object} User data and success message
 */
```

## Function Design

**Controllers:**
- All wrapped in `asyncHandler(async (req, res) => { ... })`
- Typed with `Request<Params, ResBody, ReqBody, Query>` generics when non-default types apply
- Delegate all business logic to a service; controllers only parse request, call service, and format response

**Services:**
- Implemented as classes with a singleton default export: `export default new UserService()`
- `prisma` is a private getter calling `getPrismaClient()` — never stored as a constructor field
- Static private methods for pure transformations (e.g., `normalizeEmail`, `generateRandomDigits`)
- Private async helpers for repeated DB lookups (e.g., `getUserIdByUuid`, `getExerciseByCode`)

**Middleware:**
- Written as higher-order functions returning `(req, res, next) => void` when they accept configuration
- Written as named plain functions when they require no configuration (e.g., `authenticateToken`)

## Module Design

**Services export pattern:**
```typescript
export class UserService { ... }
export default new UserService();   // singleton instance for injection
```

**Utilities export pattern:**
```typescript
export const getZodErrorMessage = ...;  // named export
export default asyncHandler;            // default export for single-purpose utils
```

**Validation schemas in `@repo/common`:**
```typescript
export const loginSchema = z.object({ ... });
export type LoginValues = z.infer<typeof loginSchema>;
```

---

*Convention analysis: 2026-03-21*
