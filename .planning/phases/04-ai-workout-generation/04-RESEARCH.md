# Phase 4: AI Workout Generation - Research

**Researched:** 2026-11-04
**Domain:** LLM structured-output workout generation (Anthropic SDK) inside an Express 5 / Prisma 7 / Expo monorepo
**Confidence:** MEDIUM-HIGH (model IDs and structured-output API verified against official docs; codebase patterns read directly; Context7 was unavailable, so SDK specifics rest on official docs fetched via WebFetch)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Height/weight gate (PROF-06)
- **D-01:** Height and weight are collected in two places that share one form and one server check: an optional, skippable step right after registration (onboarding), and an inline form on the Generate screen when the user has no metrics. Whenever an AI feature needs the metrics and they are missing, the user must enter them there.
- **D-02:** Units default from the device region (imperial for the US, metric elsewhere), with a toggle on the form. Values are converted to cm/kg before saving; storage stays metric (`BodyMetric.heightCm` / `weightKg`).
- **D-03:** Users update metrics on the profile screen (`profile-edit` gets height and weight fields). Each save inserts a new `BodyMetric` row (latest wins); a save with unchanged values is skipped, like the goal snapshot logic.
- **D-04:** The generate endpoint enforces the gate server-side: it rejects with a typed error when the user has no `BodyMetric`. The client prompt is UX only.
- **D-05:** The same gate is a single shared check for every AI feature (Phase 5 reuses it).

#### Generate flow and preview
- **D-06:** Entry point is a "Generate with AI" button on the workouts list, next to the manual create action. No new tab.
- **D-07:** Input is one free-text goal box with tappable example chips. No structured pickers (duration, days, equipment).
- **D-08:** The plan is shown as a preview and is not saved yet. The user can Save, Regenerate, or edit it in the existing workout builder first.
- **D-09:** The AI disclaimer appears on the preview and again on the Start button of any AI-generated workout, so plans opened later from the list also show it. The app must therefore remember which saved workouts are AI-generated (mechanism is the planner's call).

#### Plan shape and personalization
- **D-10:** One generation produces one workout session of 3-6 exercises, using the existing `Workout` / `WorkoutExercise` model. No multi-week schema.
- **D-11:** If the goal cannot be served by the catalog (e.g. a handstand), build the closest plan from catalog exercises and tell the user with a short note.
- **D-12:** Height and weight are sent to the LLM as context with light influence, alongside fitness level and goal. This pulls the "metrics in LLM context" half of PROF-07 into Phase 4 for workout generation; Phase 5 still owns it for form feedback.
- **D-13:** Fitness level and goal are required before generation, enforced the same way as height/weight (client prompt plus server check). No silent defaults.
- **D-14:** Add `dip` to the exercise seed (`packages/database/prisma/seed.ts`); the catalog currently has only `push_up`, `pull_up`, `squat` and `plank`.

#### Validation, failures and cost control
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

### Deferred Ideas (OUT OF SCOPE)
- Multi-week programs / personalized training programs: future phase
- A second LLM provider (e.g. hosted Qwen) and shadow-mode comparison: after Phase 4 works
- Sending video frames to Claude vision for form analysis: conflicts with "video never leaves the phone"; needs its own decision before Phase 5 planning
- Phase 5 notes from the provider discussion (deterministic metrics, pose math, confidence gating) and training-data / licensing concerns: Phase 5 and 5.1
- Docs tidy-up: planning docs say `/api/sessions/:id/...` while the router mounts both `/sessions` and `/workout-sessions`
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WKT-05 | Generate a workout from a natural-language goal | `POST /api/workouts/generate` -> `workoutGenerationService` -> `LlmProvider` (Anthropic adapter, `messages.parse` + `zodOutputFormat`); preview-only response, save via existing `POST /api/workouts` |
| WKT-06 | Validate AI workouts against catalog | Constrain model with a per-request `enum` of active exercise codes in the JSON schema AND re-validate by code server-side (enum casing is not guaranteed); map code -> exerciseId; retry ladder D-16 |
| WKT-07 | Respect fitness level and goal | `User.experienceLevel` + latest active `UserGoal` injected in prompt; required-gate (D-13); golden-set eval asserts beginner != advanced |
| PROF-06 | Height/weight gate, append-only `body_metrics` | New `bodyMetricService` (latest, insert-if-changed), shared `assertAiPrerequisites` gate, `POST/GET /api/users/me/body-metrics`, shared native form + onboarding step + profile-edit fields |
</phase_requirements>

## Summary

The phase is a classic "LLM returns constrained JSON, server validates against a closed set, retries on failure" feature. Anthropic's structured outputs (GA on `claude-haiku-5-5` and `claude-sonnet-5-5`) guarantee schema-valid JSON through `output_config.format`, and the TypeScript SDK's `client.messages.parse()` with `zodOutputFormat()` gives a typed `parsed_output`. The project already uses Zod 4, which the SDK helper supports (peer `^3.25 || ^4`). Structured outputs do not eliminate hallucination in the semantic sense, but putting the live list of active exercise codes into the schema as a string `enum` makes invalid codes nearly impossible; code-side validation remains mandatory (D-15) because enum casing is explicitly not guaranteed and numeric/length constraints are unsupported by the API (the SDK moves them into descriptions and validates locally, so server-side Zod re-validation of ranges is required too).

Everything else is established project architecture: route -> controller -> service -> Prisma, Zod in `@repo/common`, env via `config/env.ts` (and `unitEnv.ts`), pino child loggers, typed errors, unit tests with a fake provider and `createPrismaMock()`. The generate endpoint is synchronous (D-17), so the key engineering risks are request latency (3 sequential attempts inside one HTTP request), cost control (daily cap persisted in Postgres, not Redis), and honoring the CONCERN already in STATE.md: `withTimeout` cannot cancel work, so pass an `AbortSignal` to the SDK (`signal` / `timeout` request option) instead of relying on it.

Two schema additions are needed: an "AI generated" marker plus model on `Workout` (or a `WorkoutGeneration` table linked to `Workout`), and consent/cap bookkeeping. Recommended: a `WorkoutGeneration` table (one row per request, used for daily cap counting, audit, and model recording) plus nullable `Workout.generatedByModel` / `Workout.isAiGenerated` set at save time.

**Primary recommendation:** Build an `LlmProvider` interface (`generateWorkoutPlan(input, {model, signal})`), implement `AnthropicProvider` with `messages.parse` + per-request code-enum schema, orchestrate the 3-attempt ladder in `workoutGenerationService`, count the daily cap from a `workout_generations` table, and return a preview DTO; saving reuses `createWorkout` with an added optional `generation` provenance field.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 1.4.0 (npm `latest`, modified 2026-11-02) | Claude API client, `messages.parse`, `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod` | Official SDK; peer dep `zod ^3.25 || ^4` matches repo's zod 4.3.6 |
| `zod` | ^4.3.6 (already present) | Plan schema, request validation | Already the project standard |
| `express-rate-limit` | ^8.5.2 (already present) | Optional burst limiter on the generate route (secondary to the DB daily cap) | Already a dependency |

Models (verified at platform.claude.com/docs/en/models/overview): `claude-haiku-5-5` ($0.10-from / $0.50-from per MTok in/out, retirement not sooner than 2027-10-07) and `claude-sonnet-5-5` ($2 / $10 per MTok, not sooner than 2027-09-28). IDs are pinned snapshots (dateless), so the model ID string itself satisfies D-21 "name and version".

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `messages.parse` + `zodOutputFormat` | Forced tool use with a JSON schema | Older pattern; structured outputs is the current, GA mechanism |
| Postgres cap counting | Redis counter | Redis exists but production host is unconfirmed (STATE.md); Postgres row doubles as audit trail |
| `jsonSchemaOutputFormat` | `zodOutputFormat` | Plain JSON schema does not validate responses locally; use Zod |

**Installation:**
```bash
yarn workspace api add @anthropic-ai/sdk
```
Run `yarn deps:lint`; `zod` already aligned. Knip: the SDK is imported only in `apps/api`, so declare there only.

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── lib/llm/
│   ├── types.ts              # LlmProvider interface, LlmError union (RATE_LIMITED|TIMEOUT|INVALID_OUTPUT|REFUSAL|UNAVAILABLE)
│   ├── anthropicProvider.ts  # SDK adapter; maps SDK errors -> LlmError
│   └── index.ts              # getLlmProvider() singleton
├── services/
│   ├── workoutGenerationService.ts  # gate, cap, ladder, validation, persistence of generation row
│   ├── bodyMetricService.ts         # getLatest, saveIfChanged
│   └── aiPrerequisites.ts           # shared gate (D-05) -> typed errors
├── prompts/workoutPlanPrompt.ts     # pure function: (profile, goal, catalog) -> {system, user}
├── controllers/workoutGeneration.ts
packages/common/src/validations/
├── bodyMetric.ts       # input schema (heightCm, weightKg ranges) + response
└── workoutGeneration.ts # request {goalText}, preview response, plan schema
apps/api/tests/unit/helpers/fakeLlmProvider.ts
scripts/workout-eval/   # golden-set eval (manual run, not CI; knip-ignore like pose-eval)
```

### Pattern 1: Per-request schema with live catalog enum
**What:** Build the Zod schema each request with `z.enum(activeCodes as [string, ...string[]])` for `exerciseCode`, so the grammar constrains the model to real codes.
**When to use:** Always for WKT-06. Still re-validate server-side (casing not guaranteed; normalize to lowercase and look up in a `Map<code, exercise>`).
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const planSchema = z.object({
  name: z.string(),
  note: z.string().nullable(),   // D-11 closest-plan note
  exercises: z.array(z.object({
    exerciseCode: z.enum(codes),
    sets: z.number().int(),
    reps: z.number().int().nullable(),
    durationSecs: z.number().int().nullable(),
    restSecs: z.number().int(),
  })).min(1),                     // minItems only 0/1 supported by API
});

const res = await client.messages.parse(
  {
    model, max_tokens: 1500, system, messages,
    output_config: { format: zodOutputFormat(planSchema) },
  },
  { signal, timeout: attemptTimeoutMs, maxRetries: 0 },
);
if (res.stop_reason === "refusal") throw new LlmError("REFUSAL");
if (res.stop_reason === "max_tokens") throw new LlmError("INVALID_OUTPUT");
const plan = res.parsed_output; // null => INVALID_OUTPUT
```

### Pattern 2: Attempt ladder in the service (not the provider)
Service loops `[haiku, haiku+feedback, sonnet]`; provider is stateless and takes `{ model, invalidCodesFeedback? }`. Refusal and invalid-output count as an attempt failure and move up the ladder (D-16/D-20). Rate-limited/unavailable: do not burn further attempts quickly; map to 429/503 `ServiceUnavailableError`. Set SDK `maxRetries: 0` so the ladder, not the SDK, controls retries and total latency is bounded.

### Pattern 3: Post-validation beyond the catalog
After parse, enforce in code: 3-6 exercises (D-10), no duplicate consecutive-position issues, `reps` XOR `durationSecs` (existing `validateExerciseInput` rule), `exerciseType` match (STATIC_HOLD -> durationSecs, DYNAMIC -> reps), ranges that fit `createWorkoutSchema` (sets 1-99, rest 0-600), name trimmed <=100. Failures count as invalid and feed attempt 2's feedback message. Reuse `createWorkoutSchema` so a preview is always saveable.

### Pattern 4: Shared AI gate (D-04/D-05/D-13)
`assertAiPrerequisites(userId)` returns `{ level, goal, heightCm, weightKg }` or throws typed errors with machine-readable codes (`BODY_METRICS_REQUIRED`, `PROFILE_INCOMPLETE`, `AI_CONSENT_REQUIRED`) the client switches on to show the inline form. ApiError must carry a `code`; check `apps/api/src/errors/ApiError.ts` and extend if it has no code field.

### Pattern 5: Provenance and cap
- New table `WorkoutGeneration { id, userId, model, attempts, status (SUCCESS|FAILED), createdAt }`; daily cap = count rows for the user since start of UTC day (or rolling 24h; recommend rolling 24h for simplicity, message "try again tomorrow"). Count failed generations too (they cost money). Recommended cap: 10/day (discretion; Haiku cost per generation is a fraction of a cent).
- Saving: extend `createWorkoutSchema` with optional `generation: { model: string }` (or `generationId`); service sets `Workout.isAiGenerated=true`, `Workout.generatedByModel`. Expose both on `workoutWithExercisesSchema` (shared schema, per CLAUDE.md) so the Start button can show the disclaimer. Server must not trust a client-supplied model string without a matching generation row: prefer `generationId` owned by the user and not already used.
- Consent: `User.aiConsentAt DateTime?` plus `POST /api/users/me/ai-consent`; gate throws `AI_CONSENT_REQUIRED` (D-19). Store the notice version too if cheap.

### Anti-Patterns to Avoid
- Trusting `parsed_output` without checking `stop_reason`.
- Letting the SDK's default `maxRetries` (2) multiply latency under the 3-attempt ladder.
- Using `withTimeout` alone (does not cancel the paid call). Pass `AbortSignal.timeout()`/SDK `timeout` and keep `withTimeout` out of this path (or update it per STATE.md concern).
- Putting prompt text or Prisma calls in controllers.
- Hard-coding the catalog in the prompt; always read active exercises from DB (`isActive: true`).
- Asking for a "reasoning" field in the schema: can trigger a `reasoning_extraction` refusal. Use a short `note` instead.
- Duplicating plan/preview types in `apps/native/src/types/`; define in `@repo/common` (no `.openapi()`), register at `apps/api/src/openapi/schemas.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON extraction / repair from LLM text | regex/`JSON.parse` fallback | `messages.parse` + `zodOutputFormat` | Schema-guaranteed output |
| Retry/backoff to Anthropic | custom HTTP client | SDK client with `maxRetries: 0` + our ladder; SDK typed errors (`Anthropic.RateLimitError`, `APIConnectionTimeoutError`, `APIError`) | Correct error classes |
| Unit conversion | ad hoc math | one tiny pure util in native (`ftIn -> cm`, `lb -> kg`) with unit tests; clamp via shared Zod ranges | Single source of truth |
| Region detection | locale string parsing | `expo-localization` `getLocales()[0].measurementSystem` / `regionCode` (verify installed; add to `apps/native` if not) | Handles US/UK/LR/MM edge cases |
| Daily cap | in-memory counter | DB count over `workout_generations` | Survives restarts/multi-instance |
| Hallucination guard | prompt-only "only use these" | enum in schema + Map lookup | Defense in depth |

**Key insight:** The only novel logic is the validation/retry orchestration and the gate; everything else should be thin glue over existing services.

## Runtime State Inventory

Not a rename/refactor phase, but it does touch persisted data:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Seeded `exercises` table in dev/test/prod DBs lacks `dip` | Update `seed.ts` (upsert, idempotent) AND run the seed against dev/test; prod needs a seed run or data migration (a seed is not auto-applied by `prisma migrate`). Decide: add `dip` via migration SQL `INSERT ... ON CONFLICT DO NOTHING` or document running seed |
| Live service config | None - no external service stores catalog | None |
| OS-registered state | None | None |
| Secrets/env vars | New `ANTHROPIC_API_KEY` (plus model name vars) | Add to `env.ts`, `unitEnv.ts`, `.env.example`, CI secrets; `tests/unit/config/env.test.ts` asserts sync |
| Build artifacts | Prisma client must be regenerated after schema change (`yarn workspace @repo/db db:generate`) | Run generate; new migration; test DB migrations applied by `tests/globalSetup.ts` |

## Common Pitfalls

### Pitfall 1: Enum casing / numeric constraints not enforced by the API
**What goes wrong:** Model returns `"Push_Up"` or `sets: 500`; API accepted it.
**How to avoid:** Case-insensitive lookup; re-run `createWorkoutSchema`-equivalent Zod validation after parse. `minimum/maximum/minLength/maxItems` are unsupported by the API, so do not rely on them.

### Pitfall 2: Sonnet 5.5 and thinking/effort behavior
**What goes wrong:** Models API reports `thinking.types.disabled.supported = false` for Sonnet 5.5; thinking is adaptive on both models (Haiku default effort `medium`, Sonnet `high`). Latency/token spend could balloon for a simple task.
**How to avoid:** Set `output_config.effort` explicitly (low/medium for Haiku, medium for the Sonnet fallback) and a modest `max_tokens` (plan is ~400-800 tokens; use 2000 to leave room for adaptive thinking). Do not send `thinking: {type:"disabled"}` to Sonnet 5.5. Confirm accepted effort values in the effort doc when implementing (LOW-MEDIUM: only the parameter name `output_config.effort` was verified, not per-model allowed values).

### Pitfall 3: Total request latency
**What goes wrong:** Three sequential attempts exceed mobile client timeout / reverse-proxy timeout.
**How to avoid:** Per-attempt timeout (recommend 15s Haiku, 25s Sonnet) and an overall deadline (~45s) via one `AbortController`; set the native axios/fetch timeout above it (~60s) for this call only. Check the Express server `requestTimeout`/`keepAliveTimeout` and any hosting proxy limit.

### Pitfall 4: Double-spend by repeated taps
**What goes wrong:** User taps Generate twice; two paid calls.
**How to avoid:** Disable button while pending on client; server-side, insert the `workout_generations` row before the LLM call (pending) and reject if one is in flight for that user (or accept and count both).

### Pitfall 5: Refusals for innocuous input
**What goes wrong:** `stop_reason: "refusal"` returns HTTP 200 with possibly non-conforming output; billed.
**How to avoid:** Check `stop_reason` first; treat as retryable per D-20; after ladder exhaustion return a friendly error. Also sanitize/limit `goalText` (trim, max ~500 chars) and keep it in the user turn, never the system prompt (prompt injection: user text must not be able to widen the catalog, which is enforced by code anyway).

### Pitfall 6: Safety content
**What goes wrong:** Plans that are unsafe for beginners (e.g. advanced holds, high volume) or for stated weight/height edge cases.
**How to avoid:** System prompt rules (rest minimums, volume ceilings per level, no exercises beyond catalog, note on injuries: advise consulting a professional), plus code-side sanity bounds per level (e.g. beginner sets <=4, reps <=15). Disclaimer text is static UI, not model-generated.

### Pitfall 7: Preview is stateless
**What goes wrong:** "Regenerate" and "Edit in builder" need the plan on the client; builder takes a different shape.
**How to avoid:** Preview DTO should use the same fields as `createWorkoutSchema` plus `exerciseId` and hydrated `exercise` summary so `useWorkoutBuilder` can be seeded and Save posts straight to `POST /api/workouts`. If the user edits in the builder, keep `generationId` so the AI flag is retained (decision for planner: edited AI plan still flagged AI, recommended yes).

### Pitfall 8: Knip / lint gates
New exports used only by tests trip Knip. Keep provider types used by service; fake provider lives in `tests/` helpers. `scripts/workout-eval/` must be added to knip `ignore` (like `scripts/pose-eval/**`) or kept out of workspaces.

## Code Examples

### Adapter error mapping
```typescript
// Source: @anthropic-ai/sdk error classes (verify names against installed 1.4.0 typings)
try { ... } catch (e) {
  if (e instanceof Anthropic.RateLimitError) throw new LlmError("RATE_LIMITED");
  if (e instanceof Anthropic.APIConnectionTimeoutError || (e as Error).name === "AbortError") throw new LlmError("TIMEOUT");
  if (e instanceof Anthropic.APIError) throw new LlmError("UNAVAILABLE");
  throw e;
}
```

### Fake provider for unit tests
```typescript
export const createFakeLlmProvider = (script: Array<LlmResult | LlmError>): LlmProvider => ({
  generateWorkoutPlan: vi.fn(async () => { const n = script.shift()!; if (n instanceof LlmError) throw n; return n; }),
});
```
Unit tests (no network): ladder order and models used per attempt, invalid code feedback in attempt 2, refusal retry, exhaustion error, cap reached, gate errors, `saveIfChanged` skip, exact Prisma call shapes. Integration (real Postgres, fake provider injected via a module seam): `POST /workouts/generate` happy path, 4xx gates, cap, save with provenance.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Tool-use trick or "return JSON" prompting | `output_config.format` structured outputs (GA) | Schema-valid output; `output_format` + beta header is deprecated |
| Manual `thinking.budget_tokens` | Adaptive thinking + `output_config.effort` | Control cost/latency with effort |
| Dated model snapshots | Dateless pinned IDs (`claude-haiku-5-5`) | Store the ID string as the version (D-21) |

**Note:** CONTEXT uses "Haiku 5.5 / Sonnet 5.5"; verified IDs are `claude-haiku-5-5` and `claude-sonnet-5-5`. Put them in env (`LLM_MODEL_PRIMARY`, `LLM_MODEL_FALLBACK`) with these defaults.

## Open Questions

1. **Effort values and thinking defaults per model**
   - Known: `output_config.effort` exists; defaults medium (Haiku) / high (Sonnet); Sonnet 5.5 rejects thinking disabled.
   - Unclear: allowed effort levels per model, interplay with structured outputs and `max_tokens`.
   - Recommendation: planner includes a small Wave-0 spike task that runs one real call per model and records latency/tokens; set effort low on Haiku.
2. **Exact SDK error class names and `messages.parse` option signature in 1.4.0** - verified only via docs; confirm against installed typings.
3. **Production seed for `dip`** - how seeds run in prod is not documented; confirm with owner (migration SQL vs. seed run).
4. **`ApiError` machine-readable code field** - confirm it exists; client needs codes to branch between gate prompts.
5. **Anthropic data-retention/ZDR and privacy notice wording** - legal review is an existing open item (STATE.md); notice text must list level, goal, height, weight and the provider name.
6. **expo-localization installed?** Not checked in `apps/native`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 (two projects: unit, integration) |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `yarn workspace api test:unit` |
| Full suite command | `yarn workspace api test` (needs Docker Postgres :5433) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WKT-05 | generate returns preview from provider output | unit | `yarn workspace api test:unit workoutGenerationService` | Wave 0 |
| WKT-05 | endpoint 200 shape / 401 / validation | integration | `yarn workspace api test:integration workoutGeneration` | Wave 0 |
| WKT-06 | unknown/miscased codes rejected; ladder retries; exhaustion error | unit | same as above | Wave 0 |
| WKT-07 | profile level/goal appear in prompt input; missing -> typed error | unit | `... aiPrerequisites` / `workoutPlanPrompt` | Wave 0 |
| WKT-07 | beginner vs advanced differ (real model) | manual/eval | `yarn tsx scripts/workout-eval/run.ts` (needs API key, not CI) | Wave 0 |
| PROF-06 | saveIfChanged inserts/skips; latest wins; gate error; ranges | unit + integration | `... bodyMetricService` | Wave 0 |
| D-18 | cap enforced, failed generations counted | unit (fake timers) | `... workoutGenerationService` | Wave 0 |
| D-09/D-21 | save persists isAiGenerated + model; list returns them | integration | `yarn workspace api test:integration workout` | Wave 0 |
| Disclaimer UI | shown on preview and Start for AI workouts | manual (no RN test infra detected for screens) | - | manual-only |

### Sampling Rate
- Per task commit: `yarn workspace api test:unit`
- Per wave merge: `yarn workspace api test`, `yarn lint`, `yarn check-types`, `yarn knip`
- Phase gate: full suite plus `yarn format:check`, `yarn deps:lint` green

### Wave 0 Gaps
- [ ] `apps/api/tests/unit/helpers/fakeLlmProvider.ts`
- [ ] unit tests: workoutGenerationService, bodyMetricService, aiPrerequisites, anthropicProvider error mapping (mock SDK client at the I/O boundary), workoutPlanPrompt, controller
- [ ] integration tests for generate/body-metrics/consent/save-with-provenance
- [ ] add new env vars to `tests/unit/helpers/unitEnv.ts`
- [ ] `scripts/workout-eval/` golden set + knip ignore entry

## Sources

### Primary (HIGH confidence)
- https://platform.claude.com/docs/en/models/overview - model IDs, pricing, retirement, thinking notes (fetched 2026-11-04)
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs - `output_config.format`, `zodOutputFormat`, `messages.parse`, schema limits, refusal/max_tokens handling
- https://platform.claude.com/docs/en/build-with-claude/effort - `output_config.effort` param (partially read)
- npm registry: `@anthropic-ai/sdk` 1.4.0, peer zod `^3.25 || ^4`
- Repo files: `apps/api/src/{config/env.ts,utils/withTimeout.ts,services/feedbackService.ts,services/workoutService.ts,routes/workout.ts}`, `packages/database/prisma/{seed.ts,models/*.prisma,enums.prisma}`, `packages/common/src/validations/workout.ts`, CLAUDE.md, STATE.md

### Secondary / Tertiary
- None. Context7 MCP failed to connect (timeout); not used. Items marked "verify against installed typings" are LOW until checked.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions and IDs verified from official sources
- Architecture: MEDIUM-HIGH - follows existing repo conventions; some schema choices are recommendations
- Pitfalls: MEDIUM - effort/thinking details and SDK option signatures need a real-call spike

**Research date:** 2026-11-04
**Valid until:** ~2026-11-18 (fast-moving model/SDK landscape)
