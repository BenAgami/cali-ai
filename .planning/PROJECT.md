# Cali AI

## What This Is

A mobile-first calisthenics app where users build and follow workouts, then film themselves performing exercises to receive AI-powered form analysis. The AI gives real-time feedback during a set and post-set analysis after upload, helping both beginners learn correct technique and experienced athletes refine their performance.

## Core Value

Users can record themselves doing calisthenics exercises and get actionable AI feedback on their form — what they did well and what to fix.

## Requirements

### Validated

- ✓ User registration and login with JWT auth — existing
- ✓ Exercise catalog (list exercises, get by code) — existing
- ✓ Workout sessions (create, list with pagination) — existing

### Active

- [ ] User profile — display name, avatar, bio
- [ ] Workout builder (manual) — pick exercises, set reps/sets/rest, save as named workout
- [ ] Workout builder (AI-generated) — describe your goal, AI builds the workout
- [ ] AI form analysis (post-set) — record a set, upload video, receive form feedback
- [ ] AI form analysis (real-time) — live cues while performing a set
- [ ] Progress tracking — session history, form scores over time, trend visualization
- [ ] Core exercise AI coverage — push-ups, pull-ups, dips, squats (expandable)

### Out of Scope

- Real-time chat between users — social complexity, not core to the fitness value
- Web app (Next.js) as primary surface — mobile-first; web app remains a placeholder for now
- OAuth / social login — email/password sufficient for v1
- Video hosting CDN — defer until AI pipeline is validated

## Context

- **Monorepo:** Turborepo with `apps/api` (Express 5), `apps/native` (React Native / Expo SDK 54), `apps/web` (Next.js placeholder), shared `packages/` for DB, common schemas, and UI components
- **Mobile:** React Native with Expo managed workflow, expo-router file-based navigation; login screens exist but auth state is not yet wired up
- **Backend:** Three-tier REST API (Routes → Controllers → Services), PostgreSQL via Prisma 7, stateless JWT auth, Zod validation at boundary
- **AI integration:** No AI layer exists yet — the form analysis pipeline is the primary new technical surface to design
- **Exercise model:** Exercises are already seeded and served via API; active/inactive flag in place

## Constraints

- **Tech Stack:** TypeScript monorepo, React Native / Expo for mobile, Express + PostgreSQL for backend — no stack changes
- **Platform:** Mobile-first (iOS + Android via Expo); web is out of scope for v1
- **AI models:** Default to Claude API for workout generation and form feedback text; video analysis likely requires a vision-capable model or a pose estimation library (MediaPipe / TensorFlow.js)
- **Existing patterns:** Follow established conventions — asyncWrapper, validateSchema middleware, @repo/db for all DB access, @repo/common for shared schemas

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mobile-only for v1 | Camera access is native; filming UX is better on device | — Pending |
| Launch with core moves (push-ups, pull-ups, dips, squats) | Validates AI pipeline before investing in full catalog | — Pending |
| Support both real-time and post-set AI feedback | User said "either/both" — both flows have distinct value | — Pending |
| AI workout generation alongside manual builder | Addresses both structured planners and goal-first users | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-21 after initialization*
