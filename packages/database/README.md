# @repo/db

Prisma 7 schema, migrations, and the PostgreSQL client singleton. Consumed by `apps/api` services only.

## Usage

```ts
import { connectPrisma, getPrismaClient, SessionStatus } from "@repo/db";

await connectPrisma(env.DATABASE_URL); // once, at startup

const prisma = getPrismaClient(); // in services

await prisma.workoutSession.updateMany({
  where: { processingStatus: SessionStatus.PROCESSING },
  data: { processingStatus: SessionStatus.FAILED },
});
```

`getPrismaClient()` throws until `connectPrisma` has run. Never instantiate `PrismaClient` elsewhere. Generated enums and types (e.g. `SessionStatus`) are re-exported from the same entry point.

## Layout

```
.
├── prisma/
│   ├── schema.prisma     generator + datasource
│   ├── enums.prisma      all enums
│   ├── models/           one file per domain
│   ├── migrations/       committed SQL migrations
│   └── seed.ts           upserts the base exercises
├── src/
│   ├── index.ts          public exports
│   └── prisma.ts         client lifecycle (@prisma/adapter-pg)
└── generated/prisma/     generated client (gitignored)
```

`prisma/models/workout.prisma` also holds `WorkoutExercise` and `WorkoutLog`.

## Setup

Copy `.env.example` to `.env` and set `DATABASE_URL` (dev database on `:5434`).

This package's `.env` is only for tooling: `prisma.config.ts` requires `DATABASE_URL` to load, so the Prisma CLI (`db:generate`, `db:migrate:*`, `db:studio` and `db:seed`) can't run without it, and the commands that touch the database use it to know which one to run against. At runtime the package reads no env — the API validates its own `DATABASE_URL` in `apps/api/src/config/env.ts` and passes it to `connectPrisma`.

## Scripts

| Script              | Purpose                               |
| ------------------- | ------------------------------------- |
| `db:generate`       | Regenerate the client from the schema |
| `db:migrate:dev`    | Create and apply a migration (dev)    |
| `db:migrate:deploy` | Apply pending migrations (CI/prod)    |
| `db:migrate:reset`  | Drop, re-migrate, and seed the dev DB |
| `db:seed`           | Run `prisma/seed.ts`                  |
| `db:studio`         | Open Prisma Studio                    |
| `build` / `dev`     | Bundle `src/` to `dist/` with tsup    |

Run with `yarn workspace @repo/db <script>`. Turborepo runs `db:generate` before `build`, `lint`, and `check-types`.

## Adding a model

1. Add `prisma/models/<name>.prisma`.
2. `yarn workspace @repo/db db:migrate:dev --name <change>` and commit the migration.
3. Rebuild — consumers import `dist`, not the source.

## Testing

Unit tests must mock this package partially. A full mock drops the re-exported enums (`SessionStatus`, `Role`, …), so code that reads them throws.

```ts
vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));

beforeEach(() => {
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
});
```

`createPrismaMock` and `asPrismaClient` come from `apps/api/tests/unit/helpers/prismaMock.ts`. See `exerciseService.test.ts` for a full example.
