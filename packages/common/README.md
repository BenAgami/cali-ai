# @repo/common

Zod schemas and inferred types shared by `apps/api` and `apps/native`. The single source of truth for request and response shapes.

## Usage

```ts
import { loginSchema, type LoginValues } from "@repo/common";

const parseLogin = (body: unknown): LoginValues => loginSchema.parse(body);
```

## Contents

All files live in `src/validations/` and are re-exported from `src/index.ts`.

| File             | Exports                                                              |
| ---------------- | -------------------------------------------------------------------- |
| `auth`           | login, register, refresh-token, logout schemas                       |
| `user`           | profile update, goal upsert, `UserProfile`, experience/goal enums    |
| `workout`        | create/update/log inputs, `WorkoutWithExercises`, list/log responses |
| `workoutSession` | create-session input, including `videoMeta` size/duration limits     |
| `exercise`       | `ExerciseSummary`, `ExerciseDetail`, list response, type enum        |
| `pagination`     | `paginatedSchema(item)`, `PageMeta`                                  |

`src/constants/messages.ts` holds the auth validation messages (internal, not exported from the index).

## Rules

- **Framework-agnostic.** No `.openapi()` calls — `apps/native` consumes these too. OpenAPI metadata is added at the registration site in `apps/api/src/openapi/schemas.ts`.
- **Define once.** Response shapes live here; never re-declare them in `apps/native/src/types/` or the OpenAPI registry.
- **Dates are ISO strings** in response schemas.
- **Enum arrays** (`EXERCISE_TYPES`, `GOAL_TYPES`, `EXPERIENCE_LEVELS`) mirror the Prisma enums by hand — update both together.

## Adding a schema

1. Create or extend a file in `src/validations/`; export the schema and its `z.infer` type.
2. Export it from `src/index.ts`.
3. Rebuild with `yarn workspace @repo/common build` — consumers import `dist`.
