# Cali AI

## What This Is

A mobile-first calisthenics app where users build and follow workouts, then, if they choose, film themselves during a set to receive AI-powered form analysis. When they opt to record, the camera is open during the set, and when the set ends the captured body keypoints are automatically analyzed for a form band and coaching breakdown. No separate upload step, and no video leaves the phone.

## Core Value

Users can record themselves doing calisthenics exercises and get actionable AI feedback on their form — what they did well and what to fix.

## Requirements

### Validated

- ✓ User registration and login with JWT auth — existing
- ✓ Exercise catalog (list exercises, get by code) — existing
- ✓ Workout sessions (create, list with pagination) — existing
- ✓ User profile — display name, avatar, fitness level, goal, workout reminders (validated in Phase 2)
- ✓ Workout builder (manual) — pick exercises, set reps/sets/rest, save as named workout, edit, delete, start a session (validated in Phase 3)

### Active

- [ ] Workout builder (AI-generated) — describe your goal, AI builds the workout
- [ ] AI form analysis — user can record a set; automatic analysis of the captured keypoints when the set ends
- [ ] Progress tracking — session history, form scores over time, trend visualization
- [ ] Core exercise AI coverage — push-ups, pull-ups, dips, squats (expandable)

### Out of Scope

- Real-time chat between users — social complexity, not core to the fitness value
- Web app (Next.js) as primary surface — mobile-first; web app remains a placeholder for now
- OAuth / social login — email/password sufficient for v1
- Video upload and hosting — video never leaves the device; the server receives keypoints only
- Gallery video import — v1 analyzes live capture only
- Real-time form cues during a set — deferred to a future version; v1 gives feedback after the set

## Context

- **Monorepo:** Turborepo with `apps/api` (Express 5), `apps/native` (React Native / Expo SDK 54), `apps/web` (Next.js placeholder), shared `packages/` for DB, common schemas, and UI components
- **Mobile:** React Native with Expo SDK 54 as a custom EAS dev build (expo-dev-client), expo-router file-based navigation; auth state is wired up through AuthContext
- **Backend:** Three-tier REST API (Routes → Controllers → Services), PostgreSQL via Prisma 7, stateless JWT auth, Zod validation at boundary
- **AI integration:** The form analysis pipeline (on-device keypoints → server metrics → LLM feedback) is the primary new technical surface; see docs/architecture.md
- **Exercise model:** Exercises are already seeded and served via API; active/inactive flag in place

## Constraints

- **Tech Stack:** TypeScript monorepo, React Native / Expo for mobile, Express + PostgreSQL for backend — no stack changes
- **Platform:** Mobile-first (iOS + Android via Expo); web is out of scope for v1
- **AI models:** Default to Claude API for workout generation and form feedback. Pose estimation runs on-device (MoveNet via react-native-fast-tflite); the server receives keypoints, never video.
- **Existing patterns:** Follow established conventions — plain async controllers (Express 5, no asyncWrapper), validateSchema middleware, @repo/db for all DB access, @repo/common for shared schemas

## Key Decisions

| Decision                                                             | Rationale                                                                                    | Outcome   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------- |
| Mobile-only for v1                                                   | Camera access is native; filming UX is better on device                                      | — Pending |
| Launch with core moves (push-ups, pull-ups, dips, squats)            | Validates AI pipeline before investing in full catalog                                       | — Pending |
| Camera session with automatic post-set analysis; real-time cues deferred | One camera capture feeds the analysis — no separate upload step. Recording is offered per set, never automatic, because each analysis has a cost. | — Pending |
| AI workout generation alongside manual builder                       | Addresses both structured planners and goal-first users                                      | — Pending |
| Pose estimation on-device; server receives keypoints, not video      | Cheaper and lower latency than uploading video; keeps body footage on the phone              | — Pending |
| LLM scores sets at launch; own model trained later from its labels   | Cuts cost over time. The model can match the LLM but not exceed it. Needs opt-in consent.     | — Pending |
| Store raw keypoints only for users who consent to training use      | Data minimization; non-consented sets keep only the result                                   | — Pending |
| Advanced skills get researched rubrics, not trained models           | Too little data per skill; definitions are data in @repo/common                              | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-10-21 after architecture decisions (on-device pose, keypoints-only server) and Phase 3 reconciliation_
