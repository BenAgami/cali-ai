# External Integrations

**Analysis Date:** 2026-10-21

**Current architecture:** Pose estimation runs on-device. The phone sends keypoints (no video) to `POST /api/sessions/:id/capture`, which enqueues a BullMQ job. The worker calls an LLM and streams progress over SSE from `GET /api/sessions/:id/status`. Only the Postgres, Redis, and R2 (avatars) integrations below are implemented in code today. The LLM, SSE, and capture endpoint are specified in `docs/architecture.md` but not yet present in `apps/api/src`.

## APIs & External Services

**LLM (planned, not implemented):**
- Anthropic Claude - Form scoring and coaching text from metrics, exercise rubric, and user context
  - SDK/Client: none installed; no LLM package in any `package.json`
  - Auth: not configured; no LLM API key variable is defined in `apps/api/src/config/env.ts`
  - Call site: intended for the BullMQ worker (see `docs/architecture.md`, section on the analysis worker). No worker entry point exists yet.

**On-Device Pose Estimation (planned, partially declared):**
- MoveNet via TFLite (per `docs/architecture.md`; 33-point model still an open decision)
  - SDK/Client: `react-native-fast-tflite` ^2.0.0 and `react-native-vision-camera` ^4.7.3 declared in `apps/native/package.json`
  - Model file: not present in `apps/native/assets`
  - Runs entirely on the device; no network call

**Mobile Platform Services (Expo):**
- Expo EAS - Build and dev-client distribution; project ID `24329f1c-2c10-4642-9e82-d8a40330f8b5` in `apps/native/app.json` (`extra.eas.projectId`), owner `benagami`
- Expo Notifications - Local scheduled weekly reminders (`apps/native/src/hooks/useNotificationReminder.ts`); no push token registration or remote push service detected
- Expo Image Picker - Avatar selection, camera or photo library (permissions text in `apps/native/app.json`)

## Data Storage

**Databases:**
- PostgreSQL 18 (local Docker image `postgres:18-alpine`; CI service container `postgres:18-alpine`)
  - Connection: `DATABASE_URL` (validated in `apps/api/src/config/env.ts`)
  - Client: Prisma 7 with `@prisma/adapter-pg` (`packages/database/src/prisma.ts`)
  - Singleton: `connectPrisma` in `apps/api/src/index.ts`, `getPrismaClient` in services, `disconnectPrisma` in `apps/api/src/lib/shutdown.ts`
  - Schema: `packages/database/prisma/schema.prisma` plus `packages/database/prisma/models/*.prisma` and `enums.prisma`
  - Migrations: `packages/database/prisma/migrations/`
  - Local ports: dev `5434` (`postgres-dev`, db `app_dev`), test `5433` (`postgres-test`, db `app_test`) per `docker-compose.yaml`
  - Session state machine: `WorkoutSession.processingStatus` (`SessionStatus` enum, default `PENDING`, indexed as `idx_sessions_processing_status`) in `packages/database/prisma/models/workout-session.prisma`

**Redis:**
- Redis 7 (local `redis:7-alpine` on port `6379`; CI service container)
  - Connection: `REDIS_URL` (default `redis://localhost:6379`)
  - Clients: `ioredis` ^5.10.1 in `apps/api/src/lib/redis.ts` with `maxRetriesPerRequest: null` (required by BullMQ)
  - Purpose: BullMQ backing store

**Job Queue (BullMQ):**
- Queue: `video-analysis` defined in `apps/api/src/lib/queue.ts` (`videoAnalysisQueue`), typed payload `VideoAnalysisJobData` `{ sessionId, r2Key }`
  - Status: legacy video-era naming. The payload still carries an `r2Key`, which no longer matches the keypoint-only design. No producer or consumer for this queue exists yet; the only other reference is the shutdown handler in `apps/api/src/lib/shutdown.ts`, which closes it.
  - Concurrency constant: `VIDEO_ANALYSIS_WORKER_CONCURRENCY = 5` in `apps/api/src/config/constants.ts`, consumed by the R2 HTTP agent sizing in `apps/api/src/lib/r2.ts`
  - Target design: keypoint-based job, 10-minute stuck-PROCESSING timeout (per CLAUDE.md phase scope)

**File Storage:**
- Cloudflare R2 (S3-compatible object storage), used for user avatars only (per `docs/architecture.md` section 2.5: "No video or frames are stored")
  - Client: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`, configured in `apps/api/src/lib/r2.ts`
    - Endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, region `auto`
    - Timeouts: connection 5 s, request 10 s; `maxAttempts: 5`; keep-alive HTTPS agent
  - Presigned upload: `apps/api/src/services/userService.ts` generates `avatars/{userUuid}/{timestamp}.jpg` keys, presigned PUT with 300 s expiry; public URL built from `R2_PUBLIC_DOMAIN`
  - Endpoint exposing it: `POST /api/users/me/avatar-upload-url` (`apps/api/src/routes/user.ts`, `apps/api/src/controllers/user.ts`)
  - Env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN`. All are required at startup by `apps/api/src/config/env.ts`, so the API will not boot without them.

**Local filesystem:**
- Not used by the API at runtime. Build output goes to `apps/api/dist`.

**Caching:**
- None beyond the Redis queue backing store. No in-process or dedicated cache layer detected.

## Authentication & Identity

**Auth Provider:**
- Custom (no third-party identity provider)
  - Implementation: email and password. Passwords hashed with `bcrypt` in `apps/api/src/services/authService.ts`. Access tokens are JWTs signed with `JWT_SECRET` via `apps/api/src/utils/generateJwtToken.ts`, verified in `apps/api/src/middlewares/auth/authentication.ts` and `optionalAuth.ts`. Refresh tokens are random values from `apps/api/src/utils/generateRefreshToken.ts`, stored by `apps/api/src/services/refreshTokenService.ts` with reuse detection (per integration tests in `apps/api/tests/integration/auth/refresh.test.ts`).
  - Token lifetimes: `JWT_EXPIRES_IN` (default `15m`), `REFRESH_TOKEN_EXPIRES_IN` (default `7d`)
  - Role checks: `apps/api/src/middlewares/auth/authorization.ts` using the `Role` enum from `@repo/db`
  - Rate limiting on auth endpoints: `apps/api/src/middlewares/authRateLimiter.ts`
- Mobile token storage: `expo-secure-store` in `apps/native/src/api/tokenStore.ts` (keys for access and refresh tokens)
- Mobile HTTP client: `apps/native/src/api/client.ts` attaches tokens, uses a 10-second timeout, and calls a registered unauthenticated handler on 401

**OAuth / social login:** Not detected.

## Monitoring & Observability

**Error Tracking:**
- None detected. No Sentry, Bugsnag, or similar SDK in any `package.json`.

**Logs:**
- `pino` structured logging, configured in `apps/api/src/lib/logger.ts`
  - Base fields `service` and `env`; `pino-pretty` transport in development only
  - Redacts `authorization`, `cookie`, `set-cookie`, `password`, `token`, `refreshToken`, `apiKey` paths
  - HTTP request logs via `pino-http` in `apps/api/src/app.ts` (disabled under `NODE_ENV=test`)
- Health check: `GET /api/health` (`apps/api/src/routes/health.ts`), checked by the CI boot smoke test
- Note: `apps/api/src/config/env.ts` (startup validation errors) and `packages/database/src/prisma.ts` (`disconnectPrisma`) use `console.*` directly, bypassing the pino logger

**Mobile logs:** Not detected (no crash reporter or analytics SDK).

## CI/CD & Deployment

**Hosting:**
- API and worker hosting: Not declared in the repo. No Dockerfile, Procfile, `fly.toml`, `render.yaml`, or similar detected.
- Mobile distribution: EAS Build with profiles `development` (internal APK, dev client), `preview` (internal), `production` (auto-increment), per `apps/native/eas.json`. Submit profile `production` is empty.

**CI Pipeline:**
- GitHub Actions: `.github/workflows/ci.yml`
  - Triggers: push to `main`, all pull requests
  - Services: `postgres:18-alpine` on `5432`, `redis:7-alpine` on `6379`
  - CI env: `DATABASE_URL` (app_test), `REDIS_URL`, `JWT_SECRET` (CI-only value), `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `CORS_ALLOWED_ORIGINS`, and dummy `R2_*` values
  - Steps: install with `--frozen-lockfile`, build, format check, knip, deps lint, lint, type check, unit tests, integration tests, production boot smoke test against `apps/api/dist/index.js`

## Environment Configuration

**Required env vars (API, startup-validated):**
- `DATABASE_URL`
- `JWT_SECRET` (min 32 characters)
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_DOMAIN`

**Optional env vars (API):**
- `NODE_ENV`, `PORT`, `SERVICE_NAME`, `LOG_LEVEL`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `REDIS_URL`, `CORS_ALLOWED_ORIGINS`

**Required env vars (Mobile):**
- `EXPO_PUBLIC_API_BASE_URL` (`apps/native/.env`; read in `apps/native/src/api/client.ts`)

**Not yet defined (needed for planned features):**
- LLM provider API key and model settings (for the worker)
- Worker/SSE configuration beyond `SERVICE_NAME=worker`

**Secrets location:**
- Local: `apps/api/.env`, `apps/api/.env.test`, `apps/native/.env`, `packages/database/.env` (gitignored by root `.gitignore` and `apps/api/.gitignore`). Existence only is recorded here; contents were not read.
- CI: GitHub Actions `env:` block in `.github/workflows/ci.yml` (CI-only, non-production values)
- Templates: `apps/api/.env.example`, `packages/database/.env.example`

## Webhooks & Callbacks

**Incoming:**
- None. No webhook routes detected in `apps/api/src/routes/`.

**Outgoing:**
- None detected.

**Planned real-time channel:**
- SSE `GET /api/sessions/:id/status` for job progress (not implemented yet). Target is streaming from BullMQ job events to the mobile client.

**API documentation endpoints (served, not integrations):**
- OpenAPI spec generated in `apps/api/src/openapi/spec.ts`, served through `apps/api/src/routes/openapi.ts` with Scalar UI. Helmet is applied on that route.

---

*Integration audit: 2026-10-21*
