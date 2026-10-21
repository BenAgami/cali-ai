---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
stopped_at: Completed Phase 03 manual-workout-builder (merged 2026-06-19); Phase 01 infrastructure partially built
last_updated: "2026-09-24T12:00:00.000Z"
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 12
  completed_plans: 12
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Users can record themselves doing calisthenics exercises and get actionable AI feedback on their form — what they did well and what to fix.
**Current focus:** Phase 01 — infrastructure

## Current Position

Phase: 1
Plan: Not started

Already built: `processingStatus` enum on WorkoutSession, BullMQ `videoAnalysisQueue`, Redis connection, R2 client (avatars), EAS dev build (Android, with vision-camera + fast-tflite plugins).
Remaining: `POST /api/sessions/:id/capture` (keypoints in, 202 + job ID; replaces the earlier `/recording` video endpoint), analysis worker, SSE `GET /api/sessions/:id/status`, 10-minute stuck-PROCESSING reaper, and the dev-build gate (vision-camera + fast-tflite running on both iOS and Android simulators, plus a pose-accuracy check on real clips).

Architecture changed 2026-10-21: pose runs on-device, the server receives keypoints (no video, no R2 video, no frame extraction), the LLM scores at launch, and an own model is trained later from consented, labeled data. See docs/architecture.md. The `videoR2Key`/`video*` columns on WorkoutSession and the `r2Key` field in `VideoAnalysisJobData` are now obsolete and need a migration. Phase 5.1 (training data and labeling) was inserted.

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: Custom Expo dev build (react-native-vision-camera + react-native-fast-tflite) is a hard gate — validate on both simulators before writing any ML code. If it fails, on-device pose (Phase 5) is blocked and a new decision is needed.
- Phase 1: processingStatus state machine must implement full PENDING → PROCESSING → COMPLETED / FAILED with a 10-minute server-side timeout cleanup job. It currently never advances beyond PENDING.
- Phase 6 (real-time cues) is deferred (2026-10-21). When it returns, it follows Phase 5: post-set analysis validates the angle-detection approach and locks the feedback format that the real-time rule engine keys off.
- Phase 2 before Phase 4: AI workout generation prompt requires fitness level and goal from user profile for calibration.
- [Phase 02-user-profile]: Catch P2002 without meta.target check — Prisma 7 with pg driver adapter omits target field; code check alone is sufficient
- [Phase 02-user-profile]: Mock getSignedUrl in avatar upload tests — appropriate exception to no-mock rule for external AWS SDK I/O
- [Phase 02-user-profile]: useFocusEffect not useEffect on profile screen: Expo Router stack does not remount on back-navigation; useEffect with [] shows stale data after returning from profile-edit
- [Phase 02-user-profile]: Goal change detection snapshots initial goal on load, compares all fields before POST /me/goals to prevent duplicate UserGoal records on unchanged Save
- [Phase 02-user-profile]: AuthContext created as Rule 3 fix: native app had no JWT persistence; stores token in AsyncStorage under @cali_auth_token
- [Phase 02-user-profile]: One scheduleNotificationAsync call per selected weekday — WeeklyTriggerInput only accepts one weekday, so scheduling N days requires N calls
- [Phase 02-user-profile]: AsyncStorage stores both notification IDs (for cancellation) and config (for display) under separate keys workoutReminderIds and workoutReminderConfig

### Pending Todos

None yet.

### Blockers/Concerns

- INFRA-05: EAS Android dev builds succeed (2026-09-24). iOS is unverified — the `development` profile in `apps/native/eas.json` has no `ios.simulator: true`, so an iOS simulator build needs its own profile. If the gate fails on either platform, on-device pose (and therefore Phase 5) is blocked. The video-upload fallback was ruled out, so a failure would need a new decision. Real-time cues (Phase 6) are deferred, so the gate no longer protects them.
- Open decisions: pricing model and per-analysis cost cap; pose model (MoveNet vs 33-point); keypoint payload format; retention period and sampling; consent wording, minimum age and legal review; advanced-skill rubrics need a multi-source research task before Phase 5 planning.
- Redis instance: BullMQ requires Redis. Local and CI use Redis 7; production hosting (Upstash or managed Redis) is still unconfirmed.
- `expo-doctor` passes 16/18. The two remaining failures are accepted for now: the Metro config's manual monorepo overrides (`watchFolders`, `disableHierarchicalLookup`) may be redundant under SDK 54 but need testing before removal, and `react-native-fast-tflite` is flagged untested on the New Architecture — the dev-build gate is what verifies it.

## Session Continuity

Last session: 2026-09-24T12:00:00.000Z
Stopped at: Expo packages aligned with SDK 54 and doctor findings fixed; Android dev build needs rebuilding for expo-secure-store 15
Resume file: None
