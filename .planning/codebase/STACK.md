# Technology Stack

**Analysis Date:** 2026-10-21

## Languages

**Primary:**
- TypeScript 5.9 (`typescript` ^5.9.3 at root) - All workspaces: `apps/api`, `apps/native`, `packages/database`, `packages/common`, `packages/ui`, and root config (`knip.ts`, `eslint.config.mjs`)

**Secondary:**
- Prisma schema language - `packages/database/prisma/schema.prisma`, `packages/database/prisma/models/*.prisma`, `packages/database/prisma/enums.prisma`
- SQL - Migrations under `packages/database/prisma/migrations/`
- JavaScript (CJS/ESM config) - `apps/native/babel.config.js`, `apps/native/metro.config.js`, `apps/native/index.js`

## Runtime

**Server:**
- Node.js `>=24` (declared in root `package.json` `engines`; CI uses `NODE_VERSION: "24"` in `.github/workflows/ci.yml`; API build target `node24` in `apps/api/tsup.config.ts`)
- ES modules: `apps/api/package.json` sets `"type": "module"`

**Mobile:**
- React Native 0.81.5 with React 19.1.0 (`apps/native/package.json`)
- New Architecture enabled (`"newArchEnabled": true` in `apps/native/app.json`)
- EAS build Node pin: `24.19.0` (`apps/native/eas.json` `build.base.node`)

**Package Manager:**
- Yarn Classic 1.22.19 (`packageManager` in root `package.json`)
- Lockfile: present (`yarn.lock`, installed with `--frozen-lockfile` in CI)
- Workspaces: `apps/*`, `packages/*`
- Corepack used in CI (`corepack enable`)
- Special case: `nohoist` entry `**/@vitest/coverage-v8` in root `package.json`

**Task Runner:**
- Turborepo ^2.5.6 (`turbo.json`, root scripts `dev`, `build`, `lint`, `check-types`, `test`)

## Frameworks

**Backend:**
- Express ^5.1.0 - REST API, `apps/api/src/app.ts`, routes in `apps/api/src/routes/`
- BullMQ ^5.71.1 - Redis-backed job queue, `apps/api/src/lib/queue.ts`
- Prisma ^7.2.0 / `@prisma/client` ^7.3.0 with `@prisma/adapter-pg` ^7.2.0 - ORM over PostgreSQL, `packages/database/src/prisma.ts`
- Zod ^4.3.6 - Validation in `packages/common/src/validations/` and `apps/api/src/config/env.ts`
- `@asteasolutions/zod-to-openapi` ^8.5.0 + `@scalar/express-api-reference` ^0.10.6 - OpenAPI generation and docs UI, `apps/api/src/openapi/`, `apps/api/src/routes/openapi.ts`

**Mobile:**
- Expo SDK `~54.0.37` (`apps/native/package.json`)
- Expo Router `~6.0.24` - File-based routing, `apps/native/app/`
- `@tanstack/react-query` ^5.96.2 - Server state
- `react-hook-form` ^7.66.0 with `@hookform/resolvers` ^5.2.2 - Forms
- Tabs and stacks via Expo Router `Tabs`/`Stack` (`apps/native/app/(main)/(tabs)/_layout.tsx`)
- `react-native-reanimated` ~4.1.1, `react-native-worklets` 0.5.1, `react-native-gesture-handler` ~2.28.0, `react-native-screens` ~4.16.0, `react-native-safe-area-context` ~5.6.0 - Native UI infrastructure
- `react-native-draggable-flatlist` ^4.0.3 - Reorderable lists (workout builder)
- `react-native-web` ^0.21.0 and `expo start --web` script - Web target is declared but the app is mobile-only for v1

**Camera / On-Device ML (declared, not yet wired in source):**
- `react-native-vision-camera` ^4.7.3 - Camera frame source; configured as an Expo config plugin in `apps/native/app.json` with `cameraPermissionText`
- `react-native-fast-tflite` ^2.0.0 - TFLite inference for the pose model (MoveNet per `docs/architecture.md`); config plugin in `apps/native/app.json` with `enableAndroidGpuLibraries: false`
- Status: no imports of either package exist under `apps/native/src` or `apps/native/app`, and no `.tflite` model file is bundled in `apps/native/assets`

**Testing:**
- Vitest ^4.0.17 (`apps/api` devDependency; pinned `@vitest/coverage-v8` 4.0.18) - Two projects (`unit`, `integration`) in `apps/api/vitest.config.ts`
- Supertest ^7.2.2 with `@types/supertest` - HTTP integration tests in `apps/api/tests/integration/`
- No native test runner detected in `apps/native`

**Build/Dev:**
- tsup ^8.5.1 - API and package bundling (`apps/api/tsup.config.ts`, `packages/*/tsup.config.ts`); ESM output, `splitting: true`, external deps
- tsx ^4.22.4 - Dev server (`apps/api` `dev` script uses `tsx watch src/index.ts`) and Prisma seed (`tsx prisma/seed.ts`)
- cross-env ^10.1.0 - Script env injection
- Babel `@babel/core` ^7.23.7 - `apps/native/babel.config.js`
- Metro (Expo default) - `apps/native/metro.config.js`
- ESLint ^9 flat config with typescript-eslint - `eslint.config.mjs` at root and per workspace; `eslint-plugin-react-hooks` ^5 in `apps/native`
- Prettier ^3.1.1 - `.prettierrc` at root; enforced via `yarn format:check`
- Knip ^6.38.0 - Unused deps/files/exports, `knip.ts`
- syncpack ^15.3.3 - Version alignment, `.syncpackrc.json`
- TypeScript configs: `packages/typescript-config` (`@repo/typescript-config`), `apps/api/tsconfig.json`, `apps/native/tsconfig.json`
- EAS CLI - Dev/preview/production builds, `apps/native/eas.json` (`development` uses `developmentClient: true`, `buildType: "apk"` on Android)

## Key Dependencies

**Critical (API):**
- `prisma` / `@prisma/client` 7.x - Only data access path; singleton via `connectPrisma`/`getPrismaClient` in `packages/database/src/prisma.ts`. Generated client output: `packages/database/generated/prisma` (gitignored)
- `bullmq` ^5.71.1 + `ioredis` ^5.10.1 - Job queue; Redis connection in `apps/api/src/lib/redis.ts` uses `maxRetriesPerRequest: null`, required by BullMQ workers
- `jsonwebtoken` ^9.0.3 - Access tokens, `apps/api/src/utils/generateJwtToken.ts`, `apps/api/src/middlewares/auth/`
- `bcrypt` ^5.1.1 - Password hashing, `apps/api/src/services/authService.ts` (native addon; requires build tooling on install)
- `ms` ^2.1.3 - Duration parsing for `JWT_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN`, `apps/api/src/config/env.ts`
- `helmet` ^8.1.0, `cors` ^2.8.5, `express-rate-limit` ^8.5.2 - HTTP hardening; rate limiter `apps/api/src/middlewares/authRateLimiter.ts` (10 requests / 15 min, skipped in `test`)
- `pino` ^10.3.1 + `pino-http` ^11.0.0 + `pino-pretty` ^13.1.3 (dev only) - Logging, `apps/api/src/lib/logger.ts`
- `@aws-sdk/client-s3` ^3.1019.0 and `@aws-sdk/s3-request-presigner` ^3.1019.0 - S3-compatible client pointed at Cloudflare R2, `apps/api/src/lib/r2.ts`
- `@smithy/node-http-handler` ^4.5.0 - Timeouts and keep-alive agent for R2 client
- `http-status-codes` ^2.3.0 - Status constants (also required by unit tests)
- `dotenv` ^17.2.3 - Loaded in `apps/api/src/config/env.ts` and `packages/database/prisma.config.ts`

**Critical (Mobile):**
- `expo-secure-store` ~15.0.8 - Access and refresh token storage, `apps/native/src/api/tokenStore.ts`
- `@react-native-async-storage/async-storage` 2.2.0 - Non-secret preferences: theme (`apps/native/src/context/ThemeContext.tsx`) and notification reminder config (`apps/native/src/hooks/useNotificationReminder.ts`)
- `expo-notifications` ~0.32.17 - Weekly workout reminders, scheduled locally (`apps/native/src/hooks/useNotificationReminder.ts`)
- `expo-image-picker` ~17.0.11 + `expo-image-manipulator` ~14.0.8 - Avatar selection and resize (`apps/native/src/hooks/useProfileEdit.ts`)
- `expo-constants` ~18.0.14, `expo-linking` ~8.0.12, `expo-dev-client` ~6.0.21 - Runtime and custom dev build
- `@react-native-community/datetimepicker` 8.4.4 - Date input

**Shared (`packages/common`, `@repo/common`):**
- `zod` ^4.3.6 - Framework-agnostic schemas consumed by both `apps/api` and `apps/native`; no `.openapi()` calls (per CLAUDE.md)

**Shared (`packages/ui`, `@repo/ui`):**
- React and React Native are peer dependencies plus matching devDependencies, so the app's copy is the only one installed (per CLAUDE.md / syncpack config)

**Infrastructure / Tooling:**
- `@scalar/express-api-reference` ^0.10.6 - Serves API reference UI (`apps/api/src/routes/openapi.ts`)
- `supertest` ^7.2.2, `cross-env` ^10.1.0 - Tests and scripts
- `syncpack`, `knip`, `turbo` - Repo hygiene (see Frameworks > Build/Dev)

**Not present (checked):**
- No LLM SDK (no `@anthropic-ai/sdk` or similar) in any `package.json`. The LLM call is planned for the worker per `docs/architecture.md` but not yet implemented.
- No pose-estimation runtime in JS beyond the declared TFLite dependency.

## Configuration

**Environment (API):**
- Validated once at startup by Zod in `apps/api/src/config/env.ts`; the module throws on invalid input. Never read `process.env` directly elsewhere (per CLAUDE.md).
- Required variables (schema in `apps/api/src/config/env.ts`):
  - `DATABASE_URL` (must be a valid URL)
  - `JWT_SECRET` (min 32 characters)
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN` (non-empty; protocol prefix stripped)
- Optional with defaults:
  - `NODE_ENV` (`development` | `production` | `test`, default `development`)
  - `PORT` (default `3000`)
  - `SERVICE_NAME` (`api` | `worker`, default `api`)
  - `LOG_LEVEL` (optional; defaults to `debug` outside production, `info` in production)
  - `JWT_EXPIRES_IN` (default `15m`), `REFRESH_TOKEN_EXPIRES_IN` (default `7d`)
  - `REDIS_URL` (default `redis://localhost:6379`)
  - `CORS_ALLOWED_ORIGINS` (comma-separated, default `http://localhost:8081`)
- Template: `apps/api/.env.example`
- Local files present: `apps/api/.env`, `apps/api/.env.test` (both gitignored; contents not read)
- Unit tests supply env inline from `apps/api/tests/unit/helpers/unitEnv.ts`, wired through `test.env` in `apps/api/vitest.config.ts`; they never read `.env.test`

**Environment (Database tooling):**
- `packages/database/.env.example` documents `DATABASE_URL` for Prisma CLI commands
- `packages/database/prisma.config.ts` reads `DATABASE_URL` via `prisma/config` `env()` helper and sets the migrations path and seed command

**Environment (Mobile):**
- `EXPO_PUBLIC_API_BASE_URL` - Required; `apps/native/src/api/client.ts` throws at import time if unset
- Template present in `apps/native/.env` (name only recorded here; contents not read)

**Prisma:**
- Schema: `packages/database/prisma/schema.prisma`
- Generator: `prisma-client` provider, output `../generated/prisma` (client file is gitignored)
- Datasource: `postgresql`
- Scripts (in `packages/database/package.json`): `db:generate`, `db:migrate:dev`, `db:migrate:deploy`, `db:migrate:reset`, `db:seed`, `db:studio`

**Build:**
- `apps/api/tsup.config.ts` - Entry `src/index.ts`, ESM, `node24`, sourcemaps, externalizes all `dependencies`
- `apps/api/tsconfig.json` - Extends `@repo/typescript-config/node.json`; types `node`, `vitest/globals`
- `apps/native/app.json` - Expo config (bundle IDs `com.benagami.caliai` for iOS, `com.cali.ai` for Android, scheme `cali-ai`, Expo Router plugin, vision-camera, fast-tflite, notifications, image-picker, secure-store plugins)
- `apps/native/eas.json` - EAS build profiles
- `apps/native/metro.config.js`, `apps/native/babel.config.js` - Metro and Babel
- `.prettierrc`, `.prettierignore`, `.syncpackrc.json`, `knip.ts`, `turbo.json`, `.gitattributes`, `.vscode/`

**Local Infrastructure:**
- `docker-compose.yaml` at repo root:
  - `postgres-dev` - `postgres:18-alpine`, host port `5434`, database `app_dev`
  - `postgres-test` - `postgres:18-alpine`, host port `5433`, database `app_test`
  - `redis` - `redis:7-alpine`, host port `6379`, with healthcheck
- Credentials in the compose file are local defaults; they are not reproduced here

## Platform Requirements

**Development:**
- Node.js 24+, Yarn 1.22.19 via Corepack
- Docker (for Postgres 18 and Redis 7)
- C/C++ toolchain available for `bcrypt` native build
- Android/iOS toolchain or EAS for custom dev client (`expo-dev-client`), since vision-camera and fast-tflite require native code; Expo Go is not sufficient
- Run Expo and EAS commands from `apps/native`, not the repo root (per CLAUDE.md)

**Production:**
- API: Node.js 24 running the tsup bundle `apps/api/dist/index.js` (`yarn workspace api start`). CI boot-smoke-tests `GET /api/health` and SIGTERM handling.
- PostgreSQL 18 (target version matches local Docker images)
- Redis 7 (BullMQ backing store)
- Hosting target for the API, worker, and Postgres/Redis is not declared anywhere in the repo ("Not detected")
- Mobile: EAS Build (`production` profile with `autoIncrement`), iOS bundle ID `com.benagami.caliai`, Android package `com.cali.ai`
- Object storage: Cloudflare R2 (S3-compatible) for avatars only, per `docs/architecture.md` section 2.5

**CI:**
- GitHub Actions, `.github/workflows/ci.yml`, Ubuntu runner, Node 24, Postgres 18 and Redis 7 service containers
- Gate order: build, `format:check`, `knip`, `deps:lint`, lint, `check-types`, unit tests, integration tests, production boot smoke test

---

*Stack analysis: 2026-10-21*
