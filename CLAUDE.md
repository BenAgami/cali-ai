# Cali AI — Claude Code Instructions

## Project Overview

AI-powered calisthenics form feedback app. Users record themselves doing exercises during a set; post-set, Claude analyzes the video and returns a form score + coaching feedback.

Mobile-only for v1. Core exercises: push-up, pull-up, dip, squat.

## Monorepo Structure

```
apps/api          Express 5 REST API (TypeScript)
apps/native       React Native + Expo SDK 54 (Expo Router)
apps/web          Next.js placeholder — out of scope for v1
packages/database Prisma 7 schema + generated client (@repo/db)
packages/common   Zod schemas shared across apps (@repo/common)
packages/ui       React Native component library (@repo/ui)
```

Package manager: Yarn Classic 1.22.19. Task runner: Turborepo.

## API Conventions

**Three-tier architecture:** route → controller → service → Prisma. No business logic in controllers; no direct Prisma calls outside services.

**Always wrap async route handlers** with `asyncWrapper` from `apps/api/src/utils/asyncWrapper.ts`. Never use try/catch in controllers.

**Zod validation at boundaries.** Validate all request bodies in middleware before they reach controllers. Schemas live in `packages/common/src/schemas/`.

**HTTP error hierarchy** is in `apps/api/src/errors/`. Throw typed errors (e.g. `NotFoundError`, `UnauthorizedError`) — the error handler catches them.

**Prisma client** is a singleton exported from `packages/database/src/index.ts`. Never instantiate a new PrismaClient elsewhere.

**Environment variables** are validated at startup via Zod in `apps/api/src/config/env.ts`. Add new vars there with a schema entry — never read `process.env` directly elsewhere in the API.

## Known Tech Debt — Do NOT Replicate

These exist in the codebase but must not be copied into new code:

- `error: any` in `errorHandler.ts` — use `unknown` + type narrowing
- `fn: Function` in `asyncWrapper.ts` — use a typed Express handler signature
- `origin: true` in CORS config — origin wildcard + credentials disables CORS protection
- `morgan("dev")` active regardless of `NODE_ENV` — log format should differ in production
- `GET /api/users/:uuid` is unauthenticated — new profile endpoints must require auth
- `includeInactive` query param on exercises is unguarded — new admin-only params need auth checks

## Phase 1 Scope (Infrastructure)

What Phase 1 is building:
- **Async video upload**: `POST /api/sessions/:id/recording` returns 202 + job ID immediately
- **BullMQ job queue** (Redis-backed): worker processes video analysis off the request thread
- **SSE endpoint**: `GET /api/sessions/:id/status` streams job progress events to the client
- **State machine**: `WorkoutSession.processingStatus` transitions PENDING → PROCESSING → COMPLETED | FAILED; stuck PROCESSING jobs auto-fail after 10 minutes
- **Custom Expo dev build**: `react-native-vision-camera` + `react-native-fast-tflite` configured in `apps/native`

Phase 1 must also fix the critical tech debt items above (error handler typing, asyncWrapper typing, CORS origin restriction, health check DB probe).

## Database

PostgreSQL via Prisma 7. Two instances run locally via Docker:
- `:5432` — development
- `:5433` — test

Schema: `packages/database/prisma/schema.prisma`. After schema changes run `yarn workspace @repo/db db:generate` to regenerate the client.

## Testing

Vitest + Supertest for API integration tests. Tests live in `apps/api/src/tests/integration/`. Each suite wipes relevant tables before running. Never mock the database in integration tests.

Zero unit tests currently exist — don't add them unless a phase plan explicitly calls for it.

## Native App

Expo Router file-based routing. Auth screens in `app/(auth)/`, main tabs in `app/(main)/(tabs)/`. Theme tokens in `src/theme/`. Currently a managed workflow build; Phase 1 requires switching to a custom dev build for native camera + ML modules.
