---
phase: 02-user-profile
plan: 02
subsystem: ui
tags: [react-native, expo, expo-router, image-picker, image-manipulator, r2, avatar, profile]

# Dependency graph
requires:
  - phase: 02-user-profile plan 01
    provides: PATCH /api/users/me, POST /api/users/me/avatar-upload-url, POST /api/users/me/goals, GET /api/users/me with avatarUrl + goals
provides:
  - AvatarDisplay component with image-or-initials fallback (deterministic palette)
  - AuthContext providing JWT token via AsyncStorage
  - (main)/_layout.tsx stack navigator wrapping tabs, profile, and profile-edit screens
  - Home screen with avatar + greeting header, tapping navigates to profile
  - Read-only profile screen (useFocusEffect for stale-data-free refetch)
  - Profile edit form with avatar upload pipeline, username, experience level, goal change detection
affects: [02-03]

# Tech tracking
tech-stack:
  added:
    - expo-image-picker@55.0.14
    - expo-image-manipulator@55.0.11
  patterns:
    - useFocusEffect from @react-navigation/native for screen-focus data refresh (PROF-05)
    - Goal change detection via initial snapshot comparison before POST /me/goals
    - Avatar upload: launchImageLibraryAsync/launchCameraAsync -> resize 400x400 JPEG -> presigned PUT to R2 -> PATCH avatarUrl
    - AuthContext with AsyncStorage (@cali_auth_token) for JWT token persistence

key-files:
  created:
    - apps/native/src/components/AvatarDisplay.tsx
    - apps/native/src/context/AuthContext.tsx
    - apps/native/app/(main)/_layout.tsx
    - apps/native/app/(main)/profile.tsx
    - apps/native/app/(main)/profile-edit.tsx
  modified:
    - apps/native/app/(main)/(tabs)/index.tsx
    - apps/native/app/_layout.tsx
    - apps/native/package.json

key-decisions:
  - "AuthContext created as Rule 3 fix: no auth state existed in native app, needed for all API calls"
  - "useFocusEffect instead of useEffect on profile screen: Expo Router stack does not remount on back-navigation, so plain useEffect with [] would show stale data after returning from profile-edit"
  - "Goal change detection snapshots initial goal on load: prevents creating duplicate UserGoal records when user taps Save without modifying goal fields"
  - "API_BASE hardcoded to localhost:3000: appropriate for dev phase; will need env config when deploying"

patterns-established:
  - "useFocusEffect pattern: import from @react-navigation/native, wrap in useCallback, depend on token"
  - "Goal change detection: capture snapshot at load, compare all fields before POST"
  - "Avatar upload: pick -> ImageManipulator.manipulate().resize().renderAsync().saveAsync() -> presigned PUT -> PATCH avatarUrl"

requirements-completed: [PROF-01, PROF-02, PROF-03, PROF-04, PROF-05]

# Metrics
duration: 5min
completed: 2026-04-01
---

# Phase 02 Plan 02: Profile Native UI Summary

**Native profile screens with AvatarDisplay component, AuthContext, stack navigator, Home header, read-only profile (useFocusEffect), and edit form with avatar upload pipeline and goal change detection**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-01T11:04:33Z
- **Completed:** 2026-04-01T11:09:33Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint)
- **Files modified:** 8

## Accomplishments
- Built `AvatarDisplay` component rendering image URI or deterministic-color initials fallback
- Created `AuthContext` to persist JWT token in AsyncStorage (pre-requisite for all API calls)
- Created `(main)/_layout.tsx` Stack navigator with profile + profile-edit screens
- Updated Home screen with avatar + greeting header; tapping navigates to `/profile`
- Built read-only profile screen with `useFocusEffect` for guaranteed fresh data on every focus event (implements PROF-05)
- Built full profile edit form: avatar upload (ImagePicker + ImageManipulator + presigned R2 PUT), username (3-30 chars, char count display), experience level segmented control, goal type picker + title + optional target, goal change detection, 409 username error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: AvatarDisplay, stack layout, Home header, profile screen** - `7ff2662` (feat)
2. **Task 2: Profile edit form with avatar upload and goal change detection** - `1aea4b1` (feat)
3. **Task 3: Human-verify checkpoint** - awaiting verification

## Files Created/Modified
- `apps/native/src/components/AvatarDisplay.tsx` - Image-or-initials avatar with PALETTE color hash
- `apps/native/src/context/AuthContext.tsx` - JWT token state via AsyncStorage
- `apps/native/app/(main)/_layout.tsx` - Stack navigator for main group
- `apps/native/app/(main)/(tabs)/index.tsx` - Home screen with avatar header + greeting
- `apps/native/app/(main)/profile.tsx` - Read-only profile screen with useFocusEffect
- `apps/native/app/(main)/profile-edit.tsx` - Edit form with avatar upload, username, experience level, goal
- `apps/native/app/_layout.tsx` - Added AuthProvider wrapping
- `apps/native/package.json` - Added expo-image-picker, expo-image-manipulator

## Decisions Made
- **AuthContext as Rule 3 fix:** No JWT persistence existed in the native app — without it, all API calls would fail. Created minimal `AuthContext` storing token in AsyncStorage under `@cali_auth_token`.
- **`useFocusEffect` not `useEffect`:** Expo Router's stack navigator does not remount screens on back-navigation. A `useEffect(fn, [])` would never re-run when the user returns from profile-edit, causing stale data. `useFocusEffect` re-runs on every focus event.
- **Snapshot-based goal change detection:** Captures the initial goal state when the screen loads. Before calling POST /me/goals, compares all four goal fields against the snapshot. Only POSTs if at least one field changed AND title is non-empty — prevents duplicate `UserGoal` records on unchanged saves.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created AuthContext for JWT token management**
- **Found during:** Task 1 (Home screen + profile screen data fetch)
- **Issue:** No auth context or token storage existed in the native app. The login screen's `handleSignIn` is a console.log stub — no JWT is ever persisted. Without a token, all `GET /api/users/me` calls would fail with 401.
- **Fix:** Created `apps/native/src/context/AuthContext.tsx` with `AuthProvider` and `useAuth()` hook. Stores token in AsyncStorage under `@cali_auth_token`. Wrapped app root in `AuthProvider`.
- **Files modified:** `apps/native/src/context/AuthContext.tsx` (created), `apps/native/app/_layout.tsx` (added AuthProvider)
- **Verification:** TypeScript compiles; profile screen and home screen can read token via `useAuth()`
- **Committed in:** `7ff2662` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking dependency)
**Impact on plan:** The AuthContext is required for the screens to make authenticated API calls. No scope creep — it is the minimum needed to unblock the task.

## Known Stubs
- `apps/native/app/(main)/(tabs)/index.tsx` line 74: "Your workouts will appear here." — intentional placeholder for Plan 03 (ReminderCard / workout list). Does not block profile plan goal.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required for the UI screens. The API_BASE is hardcoded to `http://localhost:3000` for development.

## Next Phase Readiness
- All profile screens built and navigable
- Profile screen re-fetches on every focus event via useFocusEffect (PROF-05)
- Avatar upload pipeline is fully wired (pick/capture -> resize -> presigned PUT -> PATCH)
- Goal change detection prevents spurious duplicate UserGoal records
- No blockers for Plan 02-03 (notification preferences)
- Note: Login screen still does not persist JWT — the AuthContext exists and is ready to receive a token. The login flow needs to call `setToken(jwt)` after a successful API login response. This is tracked for the auth hardening work.

---
*Phase: 02-user-profile*
*Completed: 2026-04-01*
