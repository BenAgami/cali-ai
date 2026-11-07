# Phase 4: AI Workout Generation - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users describe a fitness goal in natural language and receive a ready-to-use workout plan that only references exercises in the seeded catalog and respects their fitness level and primary goal from their profile. Covers WKT-05, WKT-06, WKT-07 and PROF-06. Form analysis, the camera and training data belong to Phase 5 and later.

</domain>

<decisions>
## Implementation Decisions

### Height/weight gate (PROF-06)
- **D-01:** Height and weight are collected in two places that share one form and one server check: an optional, skippable step right after registration (onboarding), and an inline form on the Generate screen when the user has no metrics. Whenever an AI feature needs the metrics and they are missing, the user must enter them there.
- **D-02:** Units default from the device region (imperial for the US, metric elsewhere), with a toggle on the form. Values are converted to cm/kg before saving; storage stays metric (`BodyMetric.heightCm` / `weightKg`).
- **D-03:** Users update metrics on the profile screen (`profile-edit` gets height and weight fields). Each save inserts a new `BodyMetric` row (latest wins); a save with unchanged values is skipped, like the goal snapshot logic.
- **D-04:** The generate endpoint enforces the gate server-side: it rejects with a typed error when the user has no `BodyMetric`. The client prompt is UX only.
- **D-05:** The same gate is a single shared check for every AI feature (Phase 5 reuses it).

### Generate flow and preview
- **D-06:** Entry point is a "Generate with AI" button on the workouts list, next to the manual create action. No new tab.
- **D-07:** Input is one free-text goal box with tappable example chips. No structured pickers (duration, days, equipment).
- **D-08:** The plan is shown as a preview and is not saved yet. The user can Save, Regenerate, or edit it in the existing workout builder first.
- **D-09:** The AI disclaimer appears on the preview and again on the Start button of any AI-generated workout, so plans opened later from the list also show it. The app must therefore remember which saved workouts are AI-generated (mechanism is the planner's call).

### Plan shape and personalization
- **D-10:** One generation produces one workout session of 3-6 exercises, using the existing `Workout` / `WorkoutExercise` model. No multi-week schema.
- **D-11:** If the goal cannot be served by the catalog (e.g. a handstand), build the closest plan from catalog exercises and tell the user with a short note.
- **D-12:** Height and weight are sent to the LLM as context with light influence, alongside fitness level and goal. This pulls the "metrics in LLM context" half of PROF-07 into Phase 4 for workout generation; Phase 5 still owns it for form feedback.
- **D-13:** Fitness level and goal are required before generation, enforced the same way as height/weight (client prompt plus server check). No silent defaults.
- **D-14:** Add `dip` to the exercise seed (`packages/database/prisma/seed.ts`); the catalog currently has only `push_up`, `pull_up`, `squat` and `plank`.

### Validation, failures and cost control
- **D-15:** Every returned exercise is validated against the catalog by code; invalid or hallucinated exercises are never shown or saved.
- **D-16:** Up to three attempts per request. Attempt 1: Claude Haiku 5.5. Attempt 2: Haiku again, told which exercise names were invalid. Attempt 3: Claude Sonnet 5.5. If attempt 3 is still invalid, fail with a clear error ("couldn't generate, try again"). This replaces the roadmap's "Claude Sonnet" as the default.
- **D-17:** Generation runs inside the HTTP request, with a loading state on the phone. No BullMQ job and no SSE for this feature. A plan is not persisted until the user saves it, so closing the app mid-request loses it.
- **D-18:** A per-user daily cap on generations, with a clear "limit reached, try tomorrow" message. The number is the planner's call.
- **D-19:** A privacy notice states what is sent to the AI provider (level, goal, height, weight). The user accepts it once, before their first generation.
- **D-20:** The LLM sits behind a small provider interface with an Anthropic adapter and a fake provider for unit tests (no network). Vendor errors are normalized to our own types (rate-limited, timeout, invalid output, refusal, unavailable); refusals must be detected and retried. No second provider adapter in this phase.
- **D-21:** The model name and version used are recorded with each generated plan.
- **D-22:** A small golden-set eval checks Haiku and Sonnet on objective criteria: valid schema, all codes in the catalog, beginner and advanced plans differ for the same goal, rest times present, safety rules. The model default is confirmed by this eval, not assumed.

### Claude's Discretion
- Exact request timeout and per-attempt limits (D-16, D-17)
- Daily cap number (D-18)
- Example chip wording and disclaimer text
- How AI-generated workouts are flagged (D-09) and how the model name/version is stored (D-21)
- Exact prompt, token limits and plan content rules (progressive overload, rest, level differentiation)
- Onboarding screen layout (D-01)

</decisions>

<specifics>
## Specific Ideas

- Units auto-detected from region with a manual toggle; always converted for storage.
- Haiku first, Sonnet only as the last attempt, to keep cost minimal.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` (Phase 4 section) — goal and success criteria
- `.planning/REQUIREMENTS.md` — WKT-05, WKT-06, WKT-07, PROF-06 (PROF-07 partly overlaps, see D-12)
- `.planning/PROJECT.md` — Claude API default and the keypoints-only / video-never-leaves-the-phone constraint

### Data and architecture
- `docs/data-model.md` — workout and body metric entities
- `docs/architecture.md` — API layering and AI integration
- `docs/features.md` — feature list including AI-generated plans
- `packages/database/prisma/models/body-metric.prisma` — existing, currently unused
- `packages/database/prisma/models/workout.prisma` — `Workout` / `WorkoutExercise` shape the plan must map to
- `packages/database/prisma/seed.ts` — catalog source of truth (add `dip`)

### Prior phase decisions
- `.planning/phases/01-infrastructure/01-CONTEXT.md` — error, timeout and env conventions (`withTimeout`, typed errors)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Workout` / `WorkoutExercise` models and workout service from Phase 3: the generated plan is saved through the same path as a manual workout.
- `useWorkoutBuilder` hook and `workout-builder` screen: the preview's "edit" action can reuse them.
- `profile-edit` screen and `useProfileEdit`: extend with height/weight; goal-change snapshot logic is the pattern for skipping unchanged saves.
- `BodyMetric` model: exists with `heightCm`, `weightKg`, indexed by user and `createdAt` desc; no service yet.
- `apps/api/src/utils/withTimeout.ts` (note: it only stops waiting; it cannot cancel the inner call) and `feedbackService` stub show the existing LLM seam.

### Established Patterns
- Route → controller → service → Prisma; plain async controllers; Zod schemas in `packages/common/src/validations/`; typed HTTP errors; env vars only via `config/env.ts` (add the Anthropic key and model names there, and to `tests/unit/helpers/unitEnv.ts`).
- Unit tests mock Prisma and run without network; use a fake LLM provider.

### Integration Points
- New generate endpoint under the workout routes; server gate uses the latest `BodyMetric` plus profile level/goal.
- Workouts list screen gets the "Generate with AI" button; start action on workout detail/execute shows the disclaimer for AI workouts.
- Registration flow gets the optional onboarding step.

</code_context>

<deferred>
## Deferred Ideas

- Multi-week programs / personalized training programs: future phase
- A second LLM provider (e.g. hosted Qwen) and shadow-mode comparison: after Phase 4 works
- Sending video frames to Claude vision for form analysis: conflicts with "video never leaves the phone"; needs its own decision before Phase 5 planning
- Phase 5 notes from the provider discussion (deterministic metrics, pose math, confidence gating) and training-data / licensing concerns: Phase 5 and 5.1
- Docs tidy-up: planning docs say `/api/sessions/:id/...` while the router mounts both `/sessions` and `/workout-sessions`

</deferred>

---

*Phase: 04-ai-workout-generation*
*Context gathered: 2026-11-04*
