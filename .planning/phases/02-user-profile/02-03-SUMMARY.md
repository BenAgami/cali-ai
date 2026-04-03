---
phase: 02-user-profile
plan: "03"
subsystem: ui
tags: [expo-notifications, async-storage, react-native, datetimepicker, notifications]

# Dependency graph
requires:
  - phase: 02-user-profile/02-01
    provides: AuthContext with username available for notification body text
  - phase: 02-user-profile/02-02
    provides: Home screen structure and theme/color tokens

provides:
  - useNotificationReminder hook for scheduling, loading, and canceling weekly workout reminders
  - ReminderCard component: Home screen widget with time picker and day-of-week selector
  - Cancel-and-replace notification editing with AsyncStorage persistence
  - Android notification channel "workout-reminders" and foreground notification handler

affects: [phase-03, phase-04, phase-05]

# Tech tracking
tech-stack:
  added: [expo-notifications, "@react-native-community/datetimepicker"]
  patterns:
    - WeeklyTriggerInput scheduling — one scheduleNotificationAsync call per selected weekday
    - Cancel-and-replace pattern — all previous notification IDs loaded from AsyncStorage, cancelled individually, then new IDs persisted
    - Ghost notification reconciliation — on mount, if AsyncStorage has no IDs but OS has scheduled notifications, cancel all

key-files:
  created:
    - apps/native/src/hooks/useNotificationReminder.ts
    - apps/native/src/components/ReminderCard.tsx
  modified:
    - apps/native/app/(main)/(tabs)/index.tsx
    - apps/native/app/(main)/(tabs)/_layout.tsx
    - apps/native/package.json

key-decisions:
  - "One scheduleNotificationAsync call per selected weekday — WeeklyTriggerInput only accepts one weekday, so scheduling N days requires N calls"
  - "AsyncStorage stores both notification IDs (for cancellation) and config (for display) under separate keys"
  - "Notification handler set in _layout.tsx at module level outside component to ensure foreground display"
  - "ReminderCard uses inline expandable section (not new screen) per D-04"

patterns-established:
  - "Notification scheduling pattern: requestPermissions → cancel previous IDs → scheduleNotificationAsync per day → persist new IDs + config"
  - "Ghost reconciliation on mount: getAllScheduledNotificationsAsync check before trusting AsyncStorage state"

requirements-completed: [NOTF-01]

# Metrics
duration: ~15min
completed: 2026-04-03
---

# Phase 02 Plan 03: Notification Reminders Summary

**Weekly workout reminder system via expo-notifications: time picker, day-of-week selector, cancel-and-replace scheduling, and Home screen ReminderCard widget**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-03T08:30:00Z
- **Completed:** 2026-04-03T08:42:25Z
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 5

## Accomplishments

- useNotificationReminder hook schedules one notification per selected weekday using WeeklyTriggerInput, with cancel-and-replace on edit and ghost reconciliation on mount
- ReminderCard renders two states on the Home screen: nudge to set a reminder vs. summary of scheduled time and days, with inline time picker and day-of-week toggle buttons
- Notification body matches D-18 format: "Hey [username], time for your workout!" using username from AuthContext
- Android notification channel "workout-reminders" configured with MAX importance; foreground handler set in _layout.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Notification hook, ReminderCard component, and Home screen integration** - `550b3f8` (feat)
2. **Task 2: Verify notification reminder flow** - approved by human (checkpoint)

**Plan dependencies/chore commits:**
- `5c12fb6` - chore(02-03): add expo-notifications and datetimepicker dependencies
- `c2bc3c3` - chore(02-03): update state to checkpoint Task 2 human-verify

## Files Created/Modified

- `apps/native/src/hooks/useNotificationReminder.ts` - Hook: permission request, schedule/cancel/load reminder, AsyncStorage persistence of IDs and config
- `apps/native/src/components/ReminderCard.tsx` - Home screen widget: nudge state, scheduled state, inline time picker, day-of-week selector
- `apps/native/app/(main)/(tabs)/index.tsx` - Added ReminderCard below header with ScrollView
- `apps/native/app/(main)/(tabs)/_layout.tsx` - Added module-level Notifications.setNotificationHandler for foreground display
- `apps/native/package.json` - Added expo-notifications and @react-native-community/datetimepicker

## Decisions Made

- **One call per day:** WeeklyTriggerInput does not support multiple weekdays in a single call. Scheduling N days requires N parallel `scheduleNotificationAsync` calls. IDs from all calls are stored in AsyncStorage for bulk cancellation on edit.
- **Inline picker vs. new screen:** Per D-04, reminder editing stays on the Home screen via an expandable card section — no navigation push.
- **Module-level handler in _layout.tsx:** `setNotificationHandler` must be called before any notification fires; placing it outside the component at module level ensures it is set on initial render.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. All notifications are scheduled locally on-device via expo-notifications.

## Known Stubs

None - the ReminderCard reads the real username from AuthContext and schedules real OS notifications. No placeholder data flows to the UI.

## Next Phase Readiness

- NOTF-01 fully satisfied: users can schedule, edit, and remove weekly workout reminders
- Phase 02-user-profile is now complete (plans 01, 02, 03 all done)
- Phase 03 can proceed — user profile data (fitness level, goal, username) is available for AI prompt calibration

---
*Phase: 02-user-profile*
*Completed: 2026-04-03*
