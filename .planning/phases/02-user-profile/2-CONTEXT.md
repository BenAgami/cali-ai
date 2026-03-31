# Phase 2: User Profile - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can personalise their account with a username (display name), avatar, fitness level, and primary goal — and the profile data is available to downstream AI features that need it for calibration. Includes workout reminder notification scheduling.

</domain>

<decisions>
## Implementation Decisions

### Profile screen placement
- **D-01:** Avatar displayed in the top-left of the Home screen header, next to a greeting
- **D-02:** Tapping the avatar pushes a full-screen profile view (stack navigation, not modal)
- **D-03:** Profile screen is read-only; an "Edit" button opens a dedicated edit form screen
- **D-04:** Workout reminder is a widget/card on the Home screen — not nested under Profile or Settings

### Avatar handling
- **D-05:** Users can pick from camera roll OR take a live photo (bottom sheet with both options)
- **D-06:** Avatar is cropped to a circle on the client before upload
- **D-07:** Uploaded to R2; `avatarUrl` stored on the User record (field needs adding to schema)
- **D-08:** Users with no avatar get a generated placeholder — initials on a colored background

### Username (display name)
- **D-09:** PROF-01 "display name" = `username` field — users can edit their auto-generated username from the profile edit screen
- **D-10:** Auto-generated username at registration (email prefix + 4 digits) remains the default until user changes it
- **D-11:** No separate `displayName` field needed

### Goal input
- **D-12:** Goals map to the existing `UserGoal` model — `goalType` enum (SKILL / STRENGTH / ENDURANCE / MOBILITY / CONSISTENCY) is the broad category; `title` (varchar 120) is the specific target ("Learn planche", "Get to 20 push-ups")
- **D-13:** `targetValue` + `targetUnit` support measurable goals (e.g. 20 reps)
- **D-14:** Free text inputs capped at 100 chars with a fitness-focused placeholder hint
- **D-15:** No server-side validation of goal content in Phase 2 — AI handles nonsense gracefully in Phase 4

### Fitness level
- **D-16:** Maps directly to existing `experienceLevel` enum on User (BEGINNER / INTERMEDIATE / ADVANCED) — no schema changes needed

### Notification scheduling (NOTF-01)
- **D-17:** User picks a free time (no presets) and specific days of the week
- **D-18:** Notification text: "Hey [username], time for your workout!"
- **D-19:** Editing reminder cancels and replaces the previous scheduled notification
- **D-20:** Handled entirely client-side via expo-notifications — no database model needed

### Claude's Discretion
- Exact color algorithm for initials placeholder avatar
- Spacing, typography, and layout details on profile and edit screens
- Day-of-week selector component design
- Time picker component choice

</decisions>

<specifics>
## Specific Ideas

- Home header avatar placement reference: top-left with greeting ("Hello, [username]") — similar to the Tailor app shot shared during discussion
- Profile edit screen should have a clear Save/Cancel flow — not inline editable fields
- Workout reminder widget on Home should nudge until a reminder is set, then show the scheduled time once configured

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Schema files to read before planning
- `packages/database/prisma/models/user.prisma` — User model; `avatarUrl` field needs adding
- `packages/database/prisma/models/user-goal.prisma` — UserGoal model; already supports two-tier goal structure
- `packages/database/prisma/enums.prisma` — GoalType, ExperienceLevel enums

### Existing API to extend
- `apps/api/src/services/userService.ts` — existing user service; profile update methods need adding
- `apps/api/src/routes/user.ts` — existing user routes; profile GET/PATCH endpoints need adding
- `apps/api/src/lib/r2.ts` — R2 client already configured; reuse for avatar upload

### Native app entry points
- `apps/native/app/(main)/(tabs)/index.tsx` — Home screen; avatar widget and reminder card go here
- `apps/native/app/(main)/(tabs)/_layout.tsx` — Tab layout; no new tabs needed
- `apps/native/src/theme/colors.ts` — Theme tokens to follow for new screens

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScreenHeader` component (`packages/ui/src/ScreenHeader.tsx`): reuse for profile and edit screen headers
- `SwitchRow` component (`packages/ui/src/SwitchRow.tsx`): pattern for settings-style rows on profile screen
- `AuthInput` component (`packages/ui/src/auth/AuthInput.tsx`): reuse for edit form fields
- `ThemeContext` (`apps/native/src/context/ThemeContext.tsx`): all new screens must consume theme colors

### Established Patterns
- Three-tier API: route → controller → service → Prisma. Profile update follows the same pattern as user auth
- `asyncWrapper` on all async route handlers — no try/catch in controllers
- Zod schemas in `packages/common/src/schemas/` for all request body validation
- Throw typed errors (`NotFoundError`, `UnauthorizedError`) — never raw errors

### Integration Points
- `avatarUrl` field added to User model → regenerate Prisma client after schema change
- Profile data (`experienceLevel`, `goals`) consumed by Phase 4 AI workout generation prompt
- `username` displayed in notification text — must be current at notification schedule time

</code_context>

<deferred>
## Deferred Ideas

- Multiple active reminders (different times/days stacked) — user raised this; deferred, cancel-and-replace is sufficient for MVP
- Body metrics (height/weight) — `BodyMetric` model exists in schema but not in Phase 2 requirements
- Goal status tracking (ACTIVE/PAUSED/COMPLETED/DROPPED) — `GoalStatus` exists in schema; leave for a future phase
- Milestone system (`MilestoneDefinition`, `UserMilestone`) — in schema but out of scope for Phase 2

</deferred>

---

*Phase: 02-user-profile*
*Context gathered: 2026-03-31*
