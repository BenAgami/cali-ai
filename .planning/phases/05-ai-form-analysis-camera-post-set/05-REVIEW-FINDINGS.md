# Phase 5 PR Review Fixes: Requirements

Source: `/code-review high --max-findings all` of `feat/phase-05-ai-form-analysis-camera-post-set` against `main` (226 files), run 2026-11-12. The review had **no verification pass**, so any finding may be a false positive.

## Scope

1. **Repair the PR-fix commits.** Review every code change in `e93ef19^..HEAD` (35 commits, starting at `e93ef19 fix(native): stop Record again sending set number 0`) against CLAUDE.md and the `native-code-standards` skill. Fix poor-quality code: duplicated logic, misplaced layers, hand-rolled helpers where a library or existing helper exists, missing or weak tests, naming-rule breaks. Don't rewrite code that is already sound. Skip `abae071` (the `/visualize` skill) and docs-only commits.
2. **Fix the 28 review findings below** (R-01 to R-28).
3. **Fix the extra requirement X-01.**

## Rules for every fix

- **Verify first.** Before planning a fix, confirm the finding against the current code. If it doesn't hold, record it as dropped with the reason and don't change code.
- Follow CLAUDE.md: the three-tier API, Zod at boundaries, shared response shapes in `@repo/common`, env vars through `config/env.ts` (and `tests/unit/helpers/unitEnv.ts`), the `pino` logging rules, boolean naming (`is`/`has`/`can`/`should`), and test layout and conventions.
- **No hand-written HTTP status constants anywhere.** Use `http-status-codes`; in `apps/native`, compare as `err.status === Number(StatusCodes.X)`, because `ApiError.status` is a plain `number` and the lint rule `no-unsafe-enum-comparison` rejects a bare enum comparison.
- **Prove every behaviour fix with a test** that fails before the fix and passes after: unit tests for branches, integration tests (real Postgres on `:5433`) for HTTP and DB behaviour.
- **Schema changes:**
  - Use a Prisma migration.
  - Run `yarn workspace @repo/db db:generate` and `yarn workspace @repo/db build`; the API loads the built `@repo/db`.
  - Don't reformat unrelated models.
- **Keep docs in sync.** When a fix changes documented behaviour, update `05-RUBRICS.md` (cost guard, trackability, rubric values with a `RUBRIC_VERSION` bump) and `.planning/STATE.md` in the same plan.
- **Gates for every plan:** `yarn format:check`, `yarn lint`, `yarn check-types`, `yarn knip`, `yarn workspace api test:unit`, `yarn workspace api test:integration`.
- **Commits:** conventional, one per task, with no Claude co-author trailer.
- Native-only behaviour (R-01, R-02's app message, R-03, R-06, R-08) needs a device UAT checklist item.

## Decisions already made

- **R-01 (out-of-frame):** stop clamping landmark `x`/`y` in `useMediaPipePose`, so the server's OUT_OF_FRAME check (more than 10% of key-joint coordinates outside [0, 1]) can fire. Keep clamping visibility, since the schema bounds it to [0, 1]. The setup check's clipped-edge logic and its tests must accept past-edge values (e.g. `-0.1`, `1.1`).
- **R-02 (retry cap):**
  - Retries get their own cap, `FORM_ANALYSIS_DAILY_RETRY_CAP`, **default 5**, counted **per user over a rolling 24 h across all sessions**.
  - Over the cap, return 429 `DAILY_RETRY_LIMIT_REACHED`.
  - A refused retry (409, 428 or 429) must not count.
  - Retries still don't count toward `FORM_ANALYSIS_DAILY_CAP`.
  - The app must show a "retry limit reached" message instead of a Retry button that silently does nothing (today `useWorkoutRecordedSets.retrySet` swallows every error). The recording screen's automatic restart path (`submitOrRestart`) must also map this 429.
  - Document the cap in the OpenAPI retry route and `05-RUBRICS.md` section 11.

## Findings

### Bugs that affect users or cost money

- **R-01** `apps/native/src/pose/useMediaPipePose.ts:115`. Landmark x/y are clamped to [0, 1] on the device, so the server's OUT_OF_FRAME check (`trackability.ts:94`, counts coordinates < 0 or > 1) can never fire, and clamped limbs distort the geometry. *Scenario:* hands leave the frame during a pull-up; MediaPipe reports x = 1.15, the client sends 1.0, and the user gets a wrong SCORED band instead of "step back" advice.
- **R-02** `apps/api/src/services/captureService.ts:101`. `retryAnalysis` never calls `assertUnderDailyCap`, and `restartRun` reuses the existing PoseCapture row, so retries are uncapped. *Scenario:* a capture whose LLM output keeps failing validation ends FAILED (ANALYSIS_ERROR); POST `/sessions/:id/analysis/retry` can be repeated without limit, and each retry runs up to 2 LLM calls.
- **R-03** `apps/native/src/hooks/queries/useSessionAnalysis.ts:13`. `staleTime: Infinity` caches `openWorkoutLogId` forever, and completing the run only invalidates `workoutKeys`, so "Record again" sends a completed run's id. The 409 that follows is mapped to the retryable `UPLOAD_FAILED`. *Scenario:* the user opens a set's result during a run, taps Done, then reopens the result from workout detail and taps Record again. POST `/sessions` returns 409 ("Workout log is already completed") and Retry repeats the same 409 forever.
- **R-04** `apps/api/src/services/analysisResultQueryService.ts:188`. `listRecordedSets` silently truncates to 50 sessions with no pagination or `hasMore` flag, but workout detail treats the result as the full run history. *Scenario:* 3 exercises × 3 sets over 6 runs gives 54 sets; the oldest run shows missing sets or disappears.
- **R-05** `apps/api/src/workers/analysisProcessor.ts:181`. `saveScored`/`saveUntrackable` and `completeRun` run in separate transactions, so a result can be persisted while the session stays PROCESSING. *Scenario:* the worker dies between the commits; GET `/analysis` returns 409, the reaper marks the session FAILED, and a retry pays for the LLM again.
- **R-06** `apps/native/src/hooks/useRecordedSet.ts:384`. On a 428 the upload resets to setup and the recorded payload is never uploaded after the prerequisites are fixed, so the set is silently lost. *Scenario:* the AI_CONSENT_VERSION bump returns 428 after a full set; the user accepts consent, lands back on setup and must redo the set.
- **R-07** `apps/api/src/services/workoutService.ts:224`. Stale open-run cleanup only deletes runs with no sessions, but the client creates the session before capture. *Scenario:* the user hits the daily limit (session created, capture refused) and leaves; the run has a PENDING session, never matches `sessions: { none: {} }`, and stays open forever.
- **R-08** `apps/native/src/hooks/useRecordedSet.ts:409`. `finish()` checks `phaseRef`, which only updates on render, so a second `finish` before the re-render sees an empty buffer and forces the stage back to `setup` mid-upload. *Scenario:* Stop and the 1 s set-end interval fire in the same tick.
- **R-09** `apps/api/src/services/analysisResultQueryService.ts:106`. For UNTRACKABLE results, unknown stored reasons are filtered out; an empty list fails `reasons.min(1)` and returns 500. *Scenario:* a later RUBRIC_VERSION renames a reason while old rows hold the old string.

### LLM prompt conflicts

- **R-10** `apps/api/src/metrics/selectFindings.ts:118`. DIMENSION_GOOD positive candidates embed the band label ("was excellent/good across the set"), while the system prompt forbids mentioning the band.
- **R-11** `apps/api/src/prompts/formFeedbackPrompt.ts:65`. Raw per-rep features in degrees are sent to the LLM, while the validator rejects any "<number> degrees" text, which invites validation failures that cost 2 paid calls.
- **R-12** `apps/api/src/services/feedbackService.ts:207`. REFUSAL/INVALID_OUTPUT on an attempt is swallowed with no log, and on the last attempt the final error says "failed validation after repair" although no validation ran.

### Smaller correctness and API-contract issues

- **R-13** `apps/api/src/services/captureService.ts:134`. The daily-cap check is count-then-insert outside the `startRunWithCapture` transaction, so concurrent captures can all pass (at 14/15, two concurrent captures give 16). The same applies to R-02's retry cap.
- **R-14** `apps/api/src/services/captureService.ts:130`. `acceptedRun` answers `QUEUED` even when the session is COMPLETED, and picks the capture with an unordered `findFirst`.
- **R-15** `apps/api/src/openapi/paths/sessions.ts:49`. The capture route's 409 documents only ANALYSIS_FAILED, but the server still throws 409 "Analysis already started for this session".
- **R-16** `packages/database/prisma/migrations/20261112130000_workout_logs_cascade_on_workout_delete/migration.sql:1`. This unreleased migration switches `workout_logs.workout_id` to CASCADE, and `20261112160346` reverts it to SET NULL. Squash them into the final SET NULL migration before merge. The dev and test databases must be reset or repaired to match.

### Duplication and performance

- **R-17** `apps/api/src/workers/analysisProcessor.ts:151`. The worker re-implements AI user-context loading instead of using `aiPrerequisitesService.assertAiPrerequisites`, which already returns `experienceLevel`, `heightCm` and `weightKg`.
- **R-18** `apps/api/src/workers/analysisProcessor.ts:156`. The processor's AbortController with `llmTimeoutMs` duplicates the deadline `feedbackService` already enforces.
- **R-19** `apps/api/src/services/captureService.ts:62`. `submitCapture`/`retryAnalysis` resolve the user id twice; `findOwnedSession` already calls `getUserIdByUuid`.
- **R-20** `apps/api/src/services/analysisResultQueryService.ts:128`. Findings are re-sorted in JS after Prisma already orders by `[findingType, sortOrder]`.
- **R-21** `packages/common/src/validations/formSetEnd.ts:77`. `hadMotion` re-scans the whole recording with a sliding 2 s window on every 1 s tick (about 175 full-array filters near the 175 s auto-stop); once motion is seen it could be cached.
- **R-22** `apps/api/src/metrics/trackability.ts:352`. `chooseNearSide` is computed three times per analysis.
- **R-23** `apps/native/src/api/endpoints/sessions.ts:44`. `listByStatus` builds its query string by interpolation; use `URLSearchParams` like `workouts.ts`.
- **R-24** `apps/native/app/(main)/record-set.tsx:103`. The record-set screen derives prerequisite state twice (`useAiPrerequisiteSteps` and `useRecordedSet`).

### CLAUDE.md rule violations

- **R-25** `apps/api/src/metrics/preprocess.ts:143`. `jointTrack` is exported only for `tests/unit/metrics/preprocess.test.ts`.
- **R-26** `apps/native/src/hooks/useSpokenCues.ts:54`. `wasWarningRef` breaks the boolean naming rule.
- **R-27** `apps/api/tests/unit/metrics/segmentReps.test.ts:22`. `startLow` breaks the boolean naming rule.
- **R-28** `apps/api/tests/unit/common/formSetup.test.ts:1`. `tests/unit/common/` tests `@repo/common` code and doesn't mirror `src/`.

## Extra requirement

- **X-01** Replace every hand-written HTTP status constant in `apps/native` with `http-status-codes` (`Number(StatusCodes.X)` comparisons). Known sites: `hooks/useRecordedSet.ts` (`HTTP_CONFLICT`, `HTTP_PRECONDITION_REQUIRED`, `HTTP_TOO_MANY_REQUESTS`), `hooks/useAnalysisResultScreen.ts` (`CONFLICT_STATUS`), `hooks/queries/useSessionAnalysis.ts` (`CONFLICT_STATUS`). Search the whole app for others.
