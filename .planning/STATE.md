---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 04-07-PLAN.md
last_updated: "2026-11-04T09:48:16.044Z"
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 21
  completed_plans: 12
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Users can record themselves doing calisthenics exercises and get actionable AI feedback on their form — what they did well and what to fix.
**Current focus:** Phase 04 — ai-workout-generation

## Current Position

Phase: 04 (ai-workout-generation) — EXECUTING
Plan: 4 of 11

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

### Roadmap Evolution

- Phase 8 added: Designing the user UI and UX

### Pending Todos

None yet.

### Blockers/Concerns

- INFRA-05 (gate passed 2026-10-22, plan 01-03): the Android dev build runs the MoveNet pose pass in a vision-camera frame processor (user-verified; device, keypoint count and mean score not reported), and the EAS iOS `development-simulator` build compiles. iOS runtime verification remains an accepted, deferred risk (no Mac or Apple developer account).
- Open decisions: pricing model and per-analysis cost cap; pose model (MoveNet vs 33-point); keypoint payload format; retention period and sampling; consent wording, minimum age and legal review; rubrics for the four core exercises (error tags, thresholds, detectability) need a multi-source research task before Phase 5 planning. Advanced skills are post-MVP (EXCOV-01).
- OPEN BLOCKER (plan 01-04, roadmap criterion 6): the pose-model decision (MoveNet vs 33-point) is postponed because the developer is injured and cannot film the 16 shot-list clips. Task 1 (offline evaluator in `scripts/pose-eval/`) is done; Tasks 2 and 3 (clips, evaluation, `01-POSE-MODEL-DECISION.md`, Key Decisions row in PROJECT.md, `docs/architecture.md`) are pending. Phase 1 cannot be marked complete until this closes, and the decision must land before Phase 5 planning. Nothing else in Phase 1 depends on it; MoveNet Lightning stays the bundled default. Check that the capture schema does not cap keypoints at 17 before relying on that. Options if filming stays out of reach: have someone else perform the exercises, run a partial evaluation, or accept MoveNet Lightning explicitly as an override of D-21.
- CONCERN (Phase 5, not started): `withTimeout` in `apps/api/src/utils/withTimeout.ts` only stops waiting; it cannot cancel the inner work, so a timed-out LLM call keeps running and is paid for, and only the guarded writes make its late result harmless. When the real LLM call replaces the `feedbackService` stub, change `withTimeout` to take `(signal) => Promise<T>` and pass an `AbortSignal` to the SDK request; keep the guarded writes either way. Also type `TimeoutError.code` as a union of the known codes (`ENQUEUE_TIMEOUT`, `LLM_TIMEOUT`) so a typo cannot silently never match.
- Production deploys must run `yarn workspace @repo/db db:seed` after `db:migrate:deploy` so the `dip` exercise (Phase 4, D-14) exists; the seed is an idempotent upsert.
- Redis instance: BullMQ requires Redis. Local and CI use Redis 7; production hosting (Upstash or managed Redis) is still unconfirmed.
- `expo-doctor` passes 16/18. The two remaining failures are accepted for now: the Metro config's manual monorepo overrides (`watchFolders`, `disableHierarchicalLookup`) may be redundant under SDK 54 but need testing before removal, and `react-native-fast-tflite` is flagged untested on the New Architecture — the dev-build gate is what verifies it.

## Session Continuity

Last session: 2026-11-04T09:48:16.038Z
Stopped at: Completed 04-07-PLAN.md
Resume file: None
