---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 05-03-PLAN.md
last_updated: "2026-11-08T12:49:02.502Z"
progress:
  total_phases: 11
  completed_phases: 2
  total_plans: 39
  completed_plans: 22
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Users can record themselves doing calisthenics exercises and get actionable AI feedback on their form — what they did well and what to fix.
**Current focus:** Phase 05 — ai-form-analysis-camera-post-set

## Current Position

Phase: 05 (ai-form-analysis-camera-post-set) — EXECUTING
Plan: 2 of 18

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
| ----- | ----- | ----- | -------- |
| -     | -     | -     | -        |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

_Updated after each plan completion_
| Phase 02-user-profile P01 | 9 | 2 tasks | 12 files |
| Phase 02-user-profile P02 | 5 | 2 tasks | 8 files |
| Phase 02-user-profile P03 | 15 | 2 tasks | 5 files |
| Phase 01 P02 | 25min | 3 tasks | 11 files |
| Phase 01 P01 | 40min | 3 tasks | 20 files |
| Phase 01 P06 | 15min | 2 tasks | 6 files |
| Phase 01 P05 | 25min | 2 tasks | 5 files |
| Phase 01 P08 | 35min | 3 tasks | 12 files |
| Phase 01 P07 | 30min | 3 tasks | 18 files |
| Phase 01 P09 | 30min | 3 tasks | 12 files |
| Phase 01 P10 | multi-session | 3 tasks | 11 files |
| Phase 04 P01 | 20min | 3 tasks | 20 files |
| Phase 04 P07 | 25min | 3 tasks | 13 files |
| Phase 04 P03 | 20min | 3 tasks | 13 files |
| Phase 04 P04 | 20min | 2 tasks | 8 files |
| Phase 04 P05 | 20min | 2 tasks | 5 files |
| Phase 04 P08 | 20min | 3 tasks | 13 files |
| Phase 04 P10 | 10min | 2 tasks | 6 files |
| Phase 04 P06 | 20min | 3 tasks | 9 files |
| Phase 04 P11 | n/a | 2 tasks | 4 files |
| Phase 05 P03 | 15min | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: Custom Expo dev build (react-native-vision-camera + react-native-fast-tflite) is a hard gate — validate on both simulators before writing any ML code. If it fails, on-device pose (Phase 5) is blocked and a new decision is needed.
- Phase 1: processingStatus state machine must implement full PENDING → PROCESSING → COMPLETED / FAILED with a 3-minute server-side timeout cleanup job. It currently never advances beyond PENDING.
- Phase 6 (real-time cues) is deferred (2026-10-21). When it returns, it follows Phase 5: post-set analysis validates the angle-detection approach and locks the feedback format that the real-time rule engine keys off.
- Phase 2 before Phase 4: AI workout generation prompt requires fitness level and goal from user profile for calibration.
- [Phase 02-user-profile]: Catch P2002 without meta.target check — Prisma 7 with pg driver adapter omits target field; code check alone is sufficient
- [Phase 02-user-profile]: Mock getSignedUrl in avatar upload tests — appropriate exception to no-mock rule for external AWS SDK I/O
- [Phase 02-user-profile]: useFocusEffect not useEffect on profile screen: Expo Router stack does not remount on back-navigation; useEffect with [] shows stale data after returning from profile-edit
- [Phase 02-user-profile]: Goal change detection snapshots initial goal on load, compares all fields before POST /me/goals to prevent duplicate UserGoal records on unchanged Save
- [Phase 02-user-profile]: AuthContext created as Rule 3 fix: native app had no JWT persistence; stores token in AsyncStorage under @cali_auth_token
- [Phase 02-user-profile]: One scheduleNotificationAsync call per selected weekday — WeeklyTriggerInput only accepts one weekday, so scheduling N days requires N calls
- [Phase 02-user-profile]: AsyncStorage stores both notification IDs (for cancellation) and config (for display) under separate keys workoutReminderIds and workoutReminderConfig
- [Phase 01]: Analysis env refuses boot unless stuck timeout > retry budget and stuck + reaper interval <= 180000 ms
- [Phase 01]: Analysis stage and sub-progress persisted as WorkoutSession columns (not an AnalysisJob table); queue form-analysis with { sessionId, captureId }
- [Phase 01]: Capture storage format gzip-json-v1; payload caps 1 MiB/3600 frames/180 s/5-60 fps/17-33 keypoints in @repo/common
- [Phase 01]: Session becomes PROCESSING at capture accept (QUEUED is a persisted stage); status events published fire-and-forget
- [Phase 01]: Workers run in the API process on dedicated Redis connections; session FAILED only on final attempt, capture errors are UnrecoverableError; reaper is a BullMQ job scheduler
- [Phase 01]: Capture/retry served at /api/sessions/:id/capture and /analysis/retry; retry reuses stored capture with a new job id; failed enqueue (5s timeout) fails the run ENQUEUE_FAILED and returns 503
- [Phase 01]: SSE stream orchestration lives in analysisStreamService (subscribe-then-read, monotonic filter, terminal close); 404/409 thrown before headers, post-flush errors logged and stream closed
- [Phase 04]: Saved workout is AI-generated iff aiModel non-null; ANTHROPIC_API_KEY required only in production
- [Phase 04]: BodyMetricsForm reports stored metric until edited so imperial rounding never counts as a change
- [Phase 04]: Shared assertAiPrerequisites gate throws 428 with first missing code; body metrics compared after 1-decimal rounding
- [Phase 04]: LLM calls use SDK signal+timeout with maxRetries 0; vendor errors normalized to five LlmError codes
- [Phase 04]: Plan validator re-checks numeric ranges server-side; failed generations count toward the daily cap; a shared AbortController deadline replaces withTimeout
- [Phase 04]: Generate screen derives its step from getMissingAiPrerequisites; a 428 refetches the profile; consent copy lives in aiMessages.ts
- [Phase 04]: Edited AI plans stay flagged: builder sends generationId on create only; disclaimer shows on Start when aiModel is non-null
- [Phase 04]: Generation save: foreign/failed generationId is 404, double save 409 GENERATION_ALREADY_SAVED; edits never clear aiModel
- [Phase 04]: Sonnet (claude-sonnet-5-5, effort medium) is primary per D-22 eval; fallback rung is Sonnet at high effort. Haiku missed thresholds (58% catalogValid, 33% levelDiffers) with timeouts/UNAVAILABLE.

### Roadmap Evolution

- Phase 8 added: Designing the user UI and UX

### Pending Todos

None yet.

### Blockers/Concerns

- INFRA-05 (gate passed 2026-10-22, plan 01-03): the Android dev build runs the MoveNet pose pass in a vision-camera frame processor (user-verified; device, keypoint count and mean score not reported), and the EAS iOS `development-simulator` build compiles. iOS runtime verification remains an accepted, deferred risk (no Mac or Apple developer account).
- Open decisions: pricing model and per-analysis cost cap; keypoint payload format; retention period and sampling; consent wording, minimum age and legal review; rubrics for the four core exercises (error tags, thresholds, detectability) need a multi-source research task before Phase 5 planning. Advanced skills are post-MVP (EXCOV-01).
- RESOLVED (plan 01-04, roadmap criterion 6, 2026-11-08): pose model is BlazePose Full (33 points), passing 4/4 exercises vs 1/4 for MoveNet Lightning and Thunder; see `phases/01-infrastructure/01-POSE-MODEL-DECISION.md`. Phase 5 must integrate BlazePose on device (no official fast-tflite recipe) and recheck low light (pull-up has no dim take).
- CONCERN (Phase 5, not started): `withTimeout` in `apps/api/src/utils/withTimeout.ts` only stops waiting; it cannot cancel the inner work, so a timed-out LLM call keeps running and is paid for, and only the guarded writes make its late result harmless. When the real LLM call replaces the `feedbackService` stub, change `withTimeout` to take `(signal) => Promise<T>` and pass an `AbortSignal` to the SDK request; keep the guarded writes either way. Also type `TimeoutError.code` as a union of the known codes (`ENQUEUE_TIMEOUT`, `LLM_TIMEOUT`) so a typo cannot silently never match.
- Production deploys must run `yarn workspace @repo/db db:seed` after `db:migrate:deploy` so the `dip` exercise (Phase 4, D-14) exists; the seed is an idempotent upsert.
- Redis instance: BullMQ requires Redis. Local and CI use Redis 7; production hosting (Upstash or managed Redis) is still unconfirmed.
- `expo-doctor` passes 16/18. The two remaining failures are accepted for now: the Metro config's manual monorepo overrides (`watchFolders`, `disableHierarchicalLookup`) may be redundant under SDK 54 but need testing before removal, and `react-native-fast-tflite` is flagged untested on the New Architecture — the dev-build gate is what verifies it.

## Session Continuity

Last session: 2026-11-08T12:49:02.495Z
Stopped at: Completed 05-03-PLAN.md
Resume file: None
