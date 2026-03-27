# Technology Stack

**Analysis Date:** 2026-03-21

## Languages

**Primary:**
- TypeScript 5.x - Used across all apps and packages (API, web, native, shared packages)

**Secondary:**
- JavaScript - Config files only (`babel.config.js`, `metro.config.js`, `next.config.js`)

## Runtime

**Environment:**
- Node.js >=18 (enforced via `engines` field in root `package.json`)

**Package Manager:**
- Yarn 1.22.19 (classic)
- Lockfile: `yarn.lock` present at monorepo root

## Monorepo Tooling

**Build Orchestration:**
- Turbo 2.5.6 — task graph, caching, parallel builds
- Config: `turbo.json` at root
- Task pipeline: `build → db:generate → ^build`, `test → ^build`

## Applications

### `apps/api` — REST API Server
**Framework:**
- Express 5.1.0 — HTTP server and routing

**Key Middleware:**
- `helmet` ^8.1.0 — HTTP security headers
- `cors` ^2.8.5 — Cross-origin resource sharing
- `morgan` ^1.10.1 — HTTP request logging

**Authentication:**
- `jsonwebtoken` ^9.0.3 — JWT signing and verification
- `bcrypt` ^5.1.1 — Password hashing (10 rounds)

**Validation:**
- `zod` ^4.3.6 — Environment and request schema validation

**Utilities:**
- `dotenv` ^17.2.3 — Environment variable loading
- `http-status-codes` ^2.3.0 — HTTP status code constants
- `ms` ^2.1.3 — JWT expiry duration strings

**Build/Dev:**
- `ts-node-dev` ^2.0.0 — Dev server with hot reload (`--respawn --transpile-only`)
- `tsc` — Production build to `dist/`

**Testing:**
- `vitest` ^4.0.17 — Test runner
- `supertest` ^7.2.2 — HTTP integration testing
- `cross-env` ^10.1.0 — Cross-platform environment variable setting

### `apps/web` — Next.js Web App
**Framework:**
- Next.js ^14.0.4 — React SSR/SSG framework
- React 18.2.0 + React DOM 18.2.0

**React Native Web bridge:**
- `react-native-web` ^0.19.10 — Render React Native components on web
- `babel-plugin-react-native-web` ^0.19.10 — Babel transform for `react-native` → `react-native-web`
- Webpack alias configured in `apps/web/next.config.js`

**Linting:**
- `eslint` ^8.56.0 with `eslint-config-next` 14.0.4

### `apps/native` — React Native Mobile App
**Framework:**
- React Native 0.81.4
- React 19.1.0
- Expo SDK 54.0.0 — Managed workflow toolchain

**Navigation:**
- `expo-router` ~6.0.3 — File-based routing (Stack + Tab layouts)

**Forms:**
- `react-hook-form` ^7.66.0
- `@hookform/resolvers` ^5.2.2 — Zod resolver for form validation

**Expo modules:**
- `expo-linear-gradient` ~15.0.7 — Gradient UI effects
- `expo-status-bar` ~3.0.8 — Status bar control
- `expo-linking` ~8.0.8 — Deep linking
- `expo-constants` ~18.0.8 — App constants
- `expo-system-ui` ~6.0.7 — System UI theming
- `@expo/metro-runtime` ^6.1.2 — Metro bundler runtime

**Navigation primitives:**
- `react-native-safe-area-context` ~5.6.0
- `react-native-screens` ~4.16.0

**Storage:**
- `@react-native-async-storage/async-storage` 2.2.0 — Persisting theme preference

**Build:**
- Metro bundler (via Expo) with monorepo support in `apps/native/metro.config.js`
- Babel preset: `babel-preset-expo`

## Shared Packages

### `packages/database` (`@repo/db`)
**ORM:**
- Prisma 7.x (`prisma` ^7.2.0, `@prisma/client` ^7.3.0)
- Database adapter: `@prisma/adapter-pg` ^7.2.0 — native PostgreSQL driver adapter
- Schema location: `packages/database/prisma/schema.prisma` + per-model `.prisma` files in `packages/database/prisma/models/`
- Client output: `packages/database/generated/prisma/`
- Migration path: `packages/database/prisma/migrations/`
- Seeding: `tsx prisma/seed.ts` via `prisma.config.ts`

**Build:**
- `tsup` ^8.5.1 — bundles to both CJS and ESM

### `packages/common` (`@repo/common`)
- Zod ^4.1.12 — shared validation schemas (`loginSchema`, `registerSchema`, `createWorkoutSessionSchema`)
- React ^19.2.0 (peer dependency)
- Built with `tsup`

### `packages/ui` (`@repo/ui`)
- React Native 0.76.9 + React 18.2.0
- `@expo/vector-icons` ^15.0.2 — icon set (FontAwesome used in `GoogleSignInButton`)
- Shared React Native UI components
- Built with `tsup`

### `packages/typescript-config` (`@repo/typescript-config`)
- Shared `tsconfig` presets: `base.json`, `node.json`, `nextjs.json`, `react-native-library.json`
- Node target: ES2022, CommonJS module

## Database

**Engine:**
- PostgreSQL (Prisma datasource provider = `"postgresql"`)
- UUIDs generated via `uuidv7()` database function

## Configuration

**Environment:**
- API: `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` (validated with Zod at startup)
- Database: `DATABASE_URL` only (for Prisma CLI)
- Test: separate `.env.test` file; `DATABASE_URL` must contain `_test` string (enforced in `globalSetup.ts`)

**Build:**
- `turbo.json` — defines task dependency graph
- Per-app `tsconfig.json` extending shared `@repo/typescript-config` presets

## Platform Requirements

**Development:**
- Node.js >=18
- Yarn 1.22.19
- PostgreSQL database (local or remote)
- For native: Expo CLI, Android/iOS emulator or device

**Production:**
- Node.js >=18 server for `apps/api` (runs compiled `dist/index.js`)
- Next.js-compatible host for `apps/web`
- Expo-built binaries for `apps/native` (iOS/Android)

---

*Stack analysis: 2026-03-21*
