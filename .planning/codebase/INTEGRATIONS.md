# External Integrations

**Analysis Date:** 2026-03-21

## APIs & External Services

**AI / ML (Planned):**
- The data model (`AnalysisResult`) includes `aiModelName` and `aiModelVersion` fields, and `WorkoutSession` tracks `processingStatus` (PENDING → PROCESSING → COMPLETED/FAILED), indicating an AI video analysis pipeline is planned or in development but no SDK or HTTP client for an external AI service is present in the codebase yet.
  - Related models: `packages/database/prisma/models/analysis-result.prisma`, `packages/database/prisma/models/analysis-finding.prisma`

**Google Sign-In (UI placeholder only):**
- `packages/ui/src/auth/GoogleSignInButton.tsx` renders a "Continue with Google" button but its `onPress` handler is a no-op stub in `apps/native/app/(auth)/login.tsx`. No Google OAuth SDK is installed.

## Data Storage

**Databases:**
- PostgreSQL
  - Connection: `DATABASE_URL` env var (format: `postgresql://username:password@host:5432/dbname?schema=public`)
  - Client: Prisma 7.x with `@prisma/adapter-pg` native driver
  - Connection managed via `packages/database/src/prisma.ts` (`connectPrisma` / `disconnectPrisma`)
  - Test database: separate DB with `_test` in the URL, reset before each test suite via `prisma migrate reset`

**File Storage:**
- Not implemented. `WorkoutSession` stores video metadata fields (`videoDurationSec`, `videoFps`, `videoWidth`, `videoHeight`, `videoSizeBytes`) but no file upload service or storage SDK is present.

**Caching:**
- None. No Redis, Memcached, or in-process cache layer detected.

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication (no third-party identity provider integrated)
  - Signing: `jsonwebtoken` in `apps/api/src/utils/generateJwtToken.ts`
  - Verification: `apps/api/src/middlewares/authentication.ts` — reads `Authorization: Bearer <token>` header
  - Payload: `{ sub: uuid, role: Role }`
  - Secret: `JWT_SECRET` env var; expiry: `JWT_EXPIRES_IN` env var (default `"1h"`)
  - Passwords: `bcrypt` with 10 rounds in `apps/api/src/services/userService.ts`

**Client-side token persistence:**
- `@react-native-async-storage/async-storage` is installed in `apps/native`; currently used only for theme preference. Auth token persistence is not yet implemented (login handler is a stub).

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry, Datadog, or similar SDK detected.

**Logs:**
- API: `morgan` middleware for HTTP request logging (dev format)
- Application-level: `console.log` / `console.error` directly

## CI/CD & Deployment

**Hosting:**
- Not configured. No Dockerfile, `docker-compose.yml`, or cloud provider config found.

**CI Pipeline:**
- Not configured. No `.github/workflows/`, `.circleci/`, or similar CI config found.

## Environment Configuration

**Required env vars (API — `apps/api/.env`):**
- `PORT` — HTTP server port (default: `3000`)
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret key for JWT signing (required, no default)
- `JWT_EXPIRES_IN` — JWT expiry duration string, e.g. `"1h"` (default: `"1h"`)
- `NODE_ENV` — `development` | `production` | `test` (default: `development`)

**Required env vars (Database package — `packages/database/.env`):**
- `DATABASE_URL` — Same format; used by Prisma CLI commands only

**Test env vars (`apps/api/.env.test`):**
- Same keys as above; `DATABASE_URL` must contain `_test` in the database name to pass the safety guard in `apps/api/tests/globalSetup.ts`

**Secrets location:**
- `.env` files in `apps/api/` and `packages/database/` — not committed (in `.gitignore`)
- `.env.example` files present in both locations for developer onboarding

## Webhooks & Callbacks

**Incoming:**
- None detected.

**Outgoing:**
- None detected.

---

*Integration audit: 2026-03-21*
