# Phase 2: User Profile - Research

**Researched:** 2026-03-31
**Domain:** React Native profile UI, Expo SDK 54 permissions/notifications, R2 presigned upload, Prisma schema extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Avatar displayed in the top-left of the Home screen header, next to a greeting
- **D-02:** Tapping the avatar pushes a full-screen profile view (stack navigation, not modal)
- **D-03:** Profile screen is read-only; an "Edit" button opens a dedicated edit form screen
- **D-04:** Workout reminder is a widget/card on the Home screen — not nested under Profile or Settings
- **D-05:** Users can pick from camera roll OR take a live photo (bottom sheet with both options)
- **D-06:** Avatar is cropped to a circle on the client before upload
- **D-07:** Uploaded to R2; `avatarUrl` stored on the User record (field needs adding to schema)
- **D-08:** Users with no avatar get a generated placeholder — initials on a colored background
- **D-09:** PROF-01 "display name" = `username` field — users can edit their auto-generated username from the profile edit screen
- **D-10:** Auto-generated username at registration (email prefix + 4 digits) remains the default until user changes it
- **D-11:** No separate `displayName` field needed
- **D-12:** Goals map to the existing `UserGoal` model — `goalType` enum (SKILL / STRENGTH / ENDURANCE / MOBILITY / CONSISTENCY) is the broad category; `title` (varchar 120) is the specific target
- **D-13:** `targetValue` + `targetUnit` support measurable goals
- **D-14:** Free text inputs capped at 100 chars with a fitness-focused placeholder hint
- **D-15:** No server-side validation of goal content in Phase 2
- **D-16:** Maps directly to existing `experienceLevel` enum on User (BEGINNER / INTERMEDIATE / ADVANCED) — no schema changes needed
- **D-17:** User picks a free time (no presets) and specific days of the week
- **D-18:** Notification text: "Hey [username], time for your workout!"
- **D-19:** Editing reminder cancels and replaces the previous scheduled notification
- **D-20:** Handled entirely client-side via expo-notifications — no database model needed

### Claude's Discretion
- Exact color algorithm for initials placeholder avatar
- Spacing, typography, and layout details on profile and edit screens
- Day-of-week selector component design
- Time picker component choice

### Deferred Ideas (OUT OF SCOPE)
- Multiple active reminders (different times/days stacked)
- Body metrics (height/weight) — `BodyMetric` model exists in schema but not in Phase 2 requirements
- Goal status tracking (ACTIVE/PAUSED/COMPLETED/DROPPED)
- Milestone system (`MilestoneDefinition`, `UserMilestone`)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-01 | User can set a display name | `username` field already on User model; PATCH `/api/users/me` with Zod validation in `@repo/common`; uniqueness constraint already enforced by Prisma P2002 |
| PROF-02 | User can upload an avatar image | `expo-image-picker` + `expo-image-manipulator` client-side; presigned PUT via `@aws-sdk/s3-request-presigner` (already installed); `avatarUrl` field added to User model |
| PROF-03 | User can set fitness level | `experienceLevel` enum (BEGINNER/INTERMEDIATE/ADVANCED) already on User model; PATCH endpoint sets it; segmented control or radio picker in UI |
| PROF-04 | User can set a primary goal | `UserGoal` model already exists with `goalType` + `title` + optional `targetValue`/`targetUnit`; POST/PUT to `/api/users/me/goals`; 100 char cap enforced by Zod |
| PROF-05 | User can view and edit their profile | Read-only profile screen + edit screen (stack push); `GET /api/users/me` extended to include `experienceLevel`, `avatarUrl`, active goal; reflects immediately without logout |
| NOTF-01 | User can schedule local workout reminder notifications | `expo-notifications` weekly triggers; one notification per selected day-of-week (separate `scheduleNotificationAsync` calls); IDs stored in AsyncStorage; cancel-and-replace on edit |
</phase_requirements>

---

## Summary

Phase 2 is primarily a **full-stack CRUD phase** — schema migration, new API endpoints, and new native screens. The core complexity is concentrated in three areas: (1) avatar upload pipeline using presigned URLs, (2) multi-day notification scheduling using expo-notifications, and (3) wiring the profile data through to the UI with immediate reflection after edits.

No new back-end frameworks are needed. The API already has `@aws-sdk/s3-request-presigner` installed and the R2 client configured. Schema changes are minimal: only `avatarUrl` must be added to the User model. The `UserGoal` model, `experienceLevel` enum, and `GoalStatus` enum already exist.

On the native side, `expo-image-picker` and `expo-image-manipulator` are Expo SDK 54 packages that install with `npx expo install`. The notification system requires per-day scheduling (one `scheduleNotificationAsync` per selected weekday) because the WEEKLY trigger only accepts a single weekday. All notification IDs must be persisted to AsyncStorage to enable cancel-and-replace on edit.

**Primary recommendation:** Use presigned PUT URLs for avatar upload (no multer/multipart on the server); schedule one notification per selected day; store all scheduled notification IDs in AsyncStorage keyed to a single constant.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-image-picker | 55.0.14 | Camera roll + live camera access | Official Expo SDK library, SDK 54 compatible, declarative permissions hooks |
| expo-image-manipulator | 55.0.11 | Client-side crop + resize before upload | Official Expo SDK library; avoids server-side image processing; produces a local URI for upload |
| expo-notifications | 55.0.14 | Local notification scheduling | Official Expo SDK; works with custom dev build; WeeklyTriggerInput for recurring reminders |
| @aws-sdk/s3-request-presigner | 3.1020.0 | Generate presigned PUT URLs for R2 | Already installed; S3-compatible with R2; avoids streaming upload through the API server |
| @react-native-async-storage/async-storage | 2.2.0 | Persist notification IDs | Already installed (used by ThemeContext); key-value store for IDs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aws-sdk/client-s3 | 3.1020.0 | PutObjectCommand for presigned URL generation | Already installed; used in API to create the presigned URL |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Presigned PUT | multer + server-side pipe to R2 | Multer routes video through the API server RAM — wasteful for binary uploads; presigned URL is the correct pattern when R2 SDK is already present |
| expo-image-manipulator crop | Client-side canvas / skia | expo-image-manipulator is the canonical Expo approach; skia adds dependency weight not justified for avatar crop |
| One notification per day | Daily trigger + day-of-week check in handler | WeeklyTriggerInput is built for this; daily trigger wastes battery and requires in-app logic |

**Installation (native app):**
```bash
npx expo install expo-image-picker expo-image-manipulator expo-notifications
```

**No new API dependencies needed** — `@aws-sdk/s3-request-presigner` is already in `apps/api/package.json`.

**Version verification:** Confirmed via `npm view` against npm registry on 2026-03-31.

---

## Architecture Patterns

### Recommended Project Structure

New files for Phase 2:

```
apps/api/src/
├── controllers/
│   └── user.ts           # add: updateProfile, getAvatarUploadUrl, upsertGoal
├── services/
│   └── userService.ts    # add: updateProfile, getAvatarUploadUrl, upsertGoal
├── routes/
│   └── user.ts           # add: PATCH /me, POST /me/avatar-upload-url, POST|PUT /me/goals
packages/common/src/validations/
│   └── user.ts           # NEW: updateProfileSchema, upsertGoalSchema
packages/database/prisma/models/
│   └── user.prisma       # add: avatarUrl field

apps/native/app/(main)/
├── (tabs)/
│   └── index.tsx         # modify: add avatar widget + reminder card
├── profile.tsx           # NEW: read-only profile screen (stack-pushed)
└── profile-edit.tsx      # NEW: edit form screen (stack-pushed from profile)
apps/native/src/
├── hooks/
│   └── useNotificationReminder.ts   # NEW: schedule/cancel/load reminder logic
└── components/
    ├── AvatarDisplay.tsx            # NEW: circle avatar or initials placeholder
    └── ReminderCard.tsx             # NEW: home screen reminder widget
```

### Pattern 1: Presigned Avatar Upload Flow

**What:** API generates a short-lived PUT URL; client uploads directly to R2; client calls PATCH `/api/users/me` with the resulting public URL.

**When to use:** Any binary file upload where the payload should not transit the API server.

**Three-step flow:**
```
Client                      API                        R2
  |                           |                          |
  |-- POST /me/avatar-url --> |                          |
  |                     getSignedUrl(PutObjectCommand)   |
  |<-- { uploadUrl, key } --- |                          |
  |                           |                          |
  |-- PUT uploadUrl (binary) ------------------------------>
  |<-- 200 OK -----------------------------------------------
  |                           |                          |
  |-- PATCH /me { avatarUrl } |                          |
  |<-- 200 { user } ----------|                          |
```

**API: generate presigned URL (in userService.ts):**
```typescript
// Source: @aws-sdk/s3-request-presigner official docs
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "../lib/r2";
import { env } from "../config/env";

async getAvatarUploadUrl(userUuid: string): Promise<{ uploadUrl: string; key: string }> {
  const key = `avatars/${userUuid}/${Date.now()}.jpg`;
  const command = new PutObjectCommand({
    Bucket: env.r2.bucketName,
    Key: key,
    ContentType: "image/jpeg",
  });
  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });
  return { uploadUrl, key };
}
```

**Native: pick, crop, upload:**
```typescript
// Source: expo-image-picker + expo-image-manipulator official docs
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

// Step 1: pick
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],   // square crop
  quality: 0.8,
});
if (result.canceled) return;
const uri = result.assets[0].uri;

// Step 2: resize to 400x400 (reduces upload payload)
const ctx = ImageManipulator.manipulate(uri);
ctx.resize({ width: 400, height: 400 });
const ref = await ctx.renderAsync();
const { uri: croppedUri } = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

// Step 3: get presigned URL from API, then PUT to R2
const { uploadUrl, key } = await api.post("/users/me/avatar-upload-url");
await fetch(uploadUrl, {
  method: "PUT",
  body: { uri: croppedUri, type: "image/jpeg", name: "avatar.jpg" } as any,
  headers: { "Content-Type": "image/jpeg" },
});

// Step 4: persist public URL on user record
const publicUrl = `https://${env.R2_PUBLIC_DOMAIN}/${key}`;
await api.patch("/users/me", { avatarUrl: publicUrl });
```

**Pitfall note:** React Native's `fetch` PUT with a binary body requires passing a blob-like object `{ uri, type, name }` — do NOT pass a base64 string or the file will be corrupted. Confirmed by multiple community sources.

### Pattern 2: Multi-Day Notification Scheduling

**What:** Schedule one `WeeklyTriggerInput` notification per selected day; store all returned IDs in AsyncStorage; on edit, cancel all stored IDs then schedule the new set.

**When to use:** User selects a time + one or more days of the week (D-17).

```typescript
// Source: expo-notifications official docs + GitHub issue #30577 (no multi-day single call)
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const REMINDER_IDS_KEY = "workoutReminderIds";

// weekdays: array of 1–7 (1=Sunday, 2=Monday … 7=Saturday)
async function scheduleReminder(
  username: string,
  hour: number,
  minute: number,
  weekdays: number[]
): Promise<void> {
  // Cancel previous
  const stored = await AsyncStorage.getItem(REMINDER_IDS_KEY);
  const prevIds: string[] = stored ? JSON.parse(stored) : [];
  await Promise.all(prevIds.map(id => Notifications.cancelScheduledNotificationAsync(id)));

  // Schedule one per day
  const newIds = await Promise.all(
    weekdays.map(weekday =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: "Cali AI",
          body: `Hey ${username}, time for your workout!`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour,
          minute,
        },
      })
    )
  );

  await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(newIds));
}
```

**Permission request (must call before first schedule attempt):**
```typescript
const { status } = await Notifications.requestPermissionsAsync({
  ios: { allowAlert: true, allowBadge: true, allowSound: true },
});
if (status !== "granted") {
  // show user-facing message; do not schedule
  return;
}
```

### Pattern 3: Profile API — PATCH /me

**What:** PATCH endpoint accepts partial user update; same three-tier pattern as existing endpoints.

**Route:**
```typescript
// apps/api/src/routes/user.ts — add to existing file
router.patch(
  "/me",
  authenticateToken,
  validateSchema(z.object({ body: updateProfileSchema })),
  updateMyProfile,
);
```

**Zod schema (packages/common/src/validations/user.ts):**
```typescript
// Source: existing auth.ts pattern in @repo/common
export const updateProfileSchema = z.object({
  username: z.string().trim().min(3).max(30).optional(),
  avatarUrl: z.url().optional(),
  experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
}).refine(obj => Object.keys(obj).length > 0, "At least one field required");
```

**Service (userService.ts):**
```typescript
async updateProfile(uuid: string, data: UpdateProfileValues) {
  if (data.username) {
    const conflict = await this.prisma.user.findFirst({
      where: { username: data.username, NOT: { uuid } },
    });
    if (conflict) throw new ConflictError("Username already taken");
  }
  return this.prisma.user.update({
    where: { uuid },
    data: {
      ...(data.username && { username: data.username }),
      ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
      ...(data.experienceLevel && { experienceLevel: data.experienceLevel }),
    },
    select: { uuid: true, username: true, avatarUrl: true, experienceLevel: true, updatedAt: true },
  });
}
```

### Pattern 4: Goal Upsert

**What:** The user sets one active goal per session. POST creates or replaces the active goal. No goal status management (deferred).

**Endpoint:** `POST /api/users/me/goals` — creates a new goal record with status ACTIVE.

**Zod schema:**
```typescript
export const upsertGoalSchema = z.object({
  goalType: z.enum(["SKILL", "STRENGTH", "ENDURANCE", "MOBILITY", "CONSISTENCY"]),
  title: z.string().trim().min(1).max(100),
  targetValue: z.number().positive().optional(),
  targetUnit: z.string().trim().max(30).optional(),
});
```

### Pattern 5: GET /me Extended Response

**What:** The existing `getUserByUuid` select must include `avatarUrl`, `experienceLevel`, and the most recent ACTIVE goal.

```typescript
// In userService.ts — extend the select block
select: {
  id: true,
  uuid: true,
  email: true,
  fullName: true,
  username: true,
  avatarUrl: true,           // new field
  experienceLevel: true,     // already on model, just not selected
  createdAt: true,
  updatedAt: true,
  role: true,
  goals: {                   // include active goal
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { goalType: true, title: true, targetValue: true, targetUnit: true },
  },
},
```

### Pattern 6: Initials Placeholder Avatar

**What:** When `avatarUrl` is null, render a colored `View` with initials text overlay.

**Color algorithm (Claude's discretion — deterministic from username):**
```typescript
// deterministic color from username string hash
const PALETTE = ["#E57373","#64B5F6","#81C784","#FFB74D","#BA68C8","#4DB6AC"];
function avatarColor(username: string): string {
  const hash = username.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}
function initials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}
```

### Anti-Patterns to Avoid

- **Streaming file through the API:** Never pipe the avatar binary through Express — use presigned PUT directly to R2 to avoid memory pressure.
- **Single notification for all days:** `WeeklyTriggerInput` only accepts one `weekday` value; schedule separately per day.
- **Reading `process.env` directly:** New `R2_PUBLIC_DOMAIN` env var (for constructing the public CDN URL) must go through `env.ts` Zod schema first.
- **try/catch in controllers:** Always use `asyncWrapper`. The existing `ConflictError` (P2002 username collision) is already a typed error that the error handler catches.
- **Inline Prisma in controllers:** Profile update logic must live in `userService.ts`, not in the controller.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image selection + camera | Custom camera integration | `expo-image-picker` | Permissions, device compatibility, results already normalized |
| Image crop/resize | Canvas manipulation | `expo-image-manipulator` | Platform-native pipeline; correct output format/URI for upload |
| Presigned URL generation | Manual AWS Signature V4 | `@aws-sdk/s3-request-presigner` `getSignedUrl` | Crypto + timestamp logic; already installed |
| Notification scheduling | Background timers | `expo-notifications` WeeklyTriggerInput | OS-native scheduling survives app kill; handles Android channel requirements |
| Username uniqueness | Application-layer loop | Prisma `@unique` constraint + P2002 catch | Database enforces it atomically; the pattern is already established in registration |

---

## Schema Changes Required

### user.prisma — add `avatarUrl`

```prisma
model User {
  // ... existing fields ...
  avatarUrl String? @map("avatar_url")
  // ... rest of model ...
}
```

**Migration steps:**
1. Add field to `packages/database/prisma/models/user.prisma`
2. Run `yarn workspace @repo/db db:generate` to regenerate Prisma client
3. Run `yarn workspace @repo/db db:migrate` (or `db push` for dev) to apply to DB

### No other schema changes needed:
- `experienceLevel` already on User model
- `UserGoal` model already complete (goalType, title, targetValue, targetUnit, status, userId)
- `GoalType` and `ExperienceLevel` enums already defined in `enums.prisma`

---

## Common Pitfalls

### Pitfall 1: React Native fetch PUT with binary — wrong body type
**What goes wrong:** Passing base64 string or File object as body to presigned PUT results in a blank/corrupted image stored in R2.
**Why it happens:** React Native's fetch does not handle `Blob` the same as browsers; R2 stores exactly what it receives.
**How to avoid:** Pass `{ uri, type: "image/jpeg", name: "avatar.jpg" }` as the body (FormData-style object that React Native fetch recognizes as a file). Alternatively use `expo-file-system`'s `FileSystem.uploadAsync` with `UploadType.BINARY_CONTENT` for more control.
**Warning signs:** Image stored in R2 but displays as broken/blank; content-length header mismatch.

### Pitfall 2: expo-notifications on Android — missing channel
**What goes wrong:** Notifications silently fail on Android 8+ if no channel is set up.
**Why it happens:** Android 8.0 (API 26) requires all notifications to belong to a channel.
**How to avoid:** Call `Notifications.setNotificationChannelAsync("workout-reminders", { name: "Workout Reminders", importance: Notifications.AndroidImportance.MAX })` before scheduling. Place this in app startup (e.g., `_layout.tsx`).
**Warning signs:** Notifications work on iOS but not Android; no error thrown.

### Pitfall 3: Notification IDs lost on app reinstall / AsyncStorage clear
**What goes wrong:** Old scheduled notifications continue firing after the user "removes" their reminder, because the IDs to cancel are gone.
**Why it happens:** AsyncStorage is cleared on app reinstall; OS-scheduled notifications are not.
**How to avoid:** On app mount, call `Notifications.getAllScheduledNotificationsAsync()` to reconcile actual OS-scheduled notifications against stored IDs. If stored IDs list is empty but OS has notifications, cancel all with `cancelAllScheduledNotificationsAsync()`.
**Warning signs:** Ghost reminders firing after user has removed reminder setting.

### Pitfall 4: Username uniqueness race condition
**What goes wrong:** Two users simultaneously changing to the same username both succeed, violating the unique constraint.
**Why it happens:** Application-level check + update is not atomic.
**How to avoid:** Do NOT do a pre-check findUnique then update. Use Prisma update directly and catch `P2002` in the service (same pattern as registration). The existing `ConflictError` handling in `register()` is the template.
**Warning signs:** P2002 error surfaces as 500 instead of 409 if not caught.

### Pitfall 5: avatarUrl not returned by existing `getMyUser`
**What goes wrong:** After PATCH, the profile screen still shows the old avatar because `getMyUser` select does not include `avatarUrl`.
**Why it happens:** `getUserByUuid` has an explicit `select` block; new fields are not auto-included.
**How to avoid:** Explicitly add `avatarUrl: true` and `experienceLevel: true` to all select blocks in `getUserByUuid` and `getUserByEmail`.

### Pitfall 6: `@aws-sdk/s3-request-presigner` needs R2 public domain for final URL
**What goes wrong:** The presigned URL itself is a temporary signed URL — it is not the permanent public URL to store in `avatarUrl`.
**Why it happens:** Presigned URLs include signature parameters that expire.
**How to avoid:** After upload, construct the public CDN URL separately: `https://${R2_PUBLIC_DOMAIN}/${key}`. Add `R2_PUBLIC_DOMAIN` to `env.ts` schema. The bucket must have public access or a custom domain configured in Cloudflare.

---

## Code Examples

### Verified: expo-notifications weekly trigger
```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/notifications/
await Notifications.scheduleNotificationAsync({
  content: { title: "Cali AI", body: `Hey ${username}, time for your workout!` },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: 2, // 1=Sunday, 2=Monday … 7=Saturday
    hour: 7,
    minute: 30,
  },
});
```

### Verified: expo-image-picker from library
```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/imagepicker/
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
});
if (!result.canceled) {
  const uri = result.assets[0].uri;
}
```

### Verified: expo-image-manipulator resize + save
```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/imagemanipulator/
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
const ctx = ImageManipulator.manipulate(uri);
ctx.resize({ width: 400, height: 400 });
const ref = await ctx.renderAsync();
const { uri: finalUri } = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
```

### Verified: getSignedUrl with PutObjectCommand
```typescript
// Source: @aws-sdk/s3-request-presigner docs
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const command = new PutObjectCommand({
  Bucket: env.r2.bucketName,
  Key: `avatars/${userUuid}/${Date.now()}.jpg`,
  ContentType: "image/jpeg",
});
const url = await getSignedUrl(r2Client, command, { expiresIn: 300 });
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ImageManipulator.manipulate(uri, actions, options)` (Expo SDK <52) | `ImageManipulator.manipulate(uri)` context builder API | SDK 52 | Chained method calls replace flat actions array |
| `mediaTypes: ImagePicker.MediaTypeOptions.Images` | `mediaTypes: ["images"]` | SDK 52+ | Enum deprecated in favour of string array |
| `expo-notifications` in Expo Go (push) | Requires dev build for push (SDK 53+) | SDK 53 | Local notifications still work in Expo Go; project already has dev-client configured |

**Deprecated/outdated:**
- `ImagePicker.MediaTypeOptions.Images`: deprecated — use `["images"]` string array
- `ImageManipulator` flat actions API: deprecated in SDK 52 — use context builder chain

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.17 + Supertest 7.2.2 |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `yarn workspace api test --reporter=verbose --testPathPattern="users"` |
| Full suite command | `yarn workspace api test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-01 | PATCH /me updates username, rejects duplicate | integration | `yarn workspace api test --testPathPattern="updateProfile"` | ❌ Wave 0 |
| PROF-02 | POST /me/avatar-upload-url returns signed URL | integration | `yarn workspace api test --testPathPattern="avatarUpload"` | ❌ Wave 0 |
| PROF-03 | PATCH /me updates experienceLevel | integration | covered in updateProfile test | ❌ Wave 0 |
| PROF-04 | POST /me/goals creates UserGoal record | integration | `yarn workspace api test --testPathPattern="goals"` | ❌ Wave 0 |
| PROF-05 | GET /me returns avatarUrl, experienceLevel, active goal | integration | covered in updateProfile test | ❌ Wave 0 |
| NOTF-01 | Client-side only — no server component | manual-only | n/a — no server to test | n/a |

### Sampling Rate
- **Per task commit:** `yarn workspace api test --testPathPattern="users"`
- **Per wave merge:** `yarn workspace api test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/tests/integration/users/updateProfile.test.ts` — covers PROF-01, PROF-02, PROF-03, PROF-05
- [ ] `apps/api/tests/integration/users/goals.test.ts` — covers PROF-04
- [ ] `apps/api/tests/integration/helpers/requestSender/usersRequests.ts` — add `patchMyProfile`, `postAvatarUploadUrl`, `postMyGoal` helpers

---

## Open Questions

1. **R2 public domain for avatarUrl**
   - What we know: The R2 client and bucket name are configured; `@aws-sdk/s3-request-presigner` is installed.
   - What's unclear: Is the R2 bucket configured with a public custom domain in Cloudflare? What is `R2_PUBLIC_DOMAIN`?
   - Recommendation: Add `R2_PUBLIC_DOMAIN` to `env.ts` as a required string env var. The planner should note this as a pre-condition (env var must be set before avatar upload works end-to-end).

2. **Bottom sheet component for avatar source picker (D-05)**
   - What we know: No bottom sheet library is currently installed in the native app.
   - What's unclear: The project has not established a standard bottom sheet; Claude's discretion applies here.
   - Recommendation: Use a simple Modal + two `TouchableOpacity` buttons rather than installing a heavy bottom sheet library (e.g., `@gorhom/bottom-sheet`). This is an MVP — functional correctness over polish.

3. **Time picker for notification scheduling (D-17, Claude's discretion)**
   - What we know: No time picker library is installed. Expo does not ship a built-in time picker component.
   - What's unclear: Whether to use React Native's `DateTimePicker` (via `@react-native-community/datetimepicker`) or a custom scroll picker.
   - Recommendation: Use `@react-native-community/datetimepicker` — it renders the native OS time picker on both Android and iOS. Install with `npx expo install @react-native-community/datetimepicker`.

---

## Sources

### Primary (HIGH confidence)
- [expo-notifications official docs](https://docs.expo.dev/versions/latest/sdk/notifications/) — weekly trigger API, permission request, channel setup, getAllScheduledNotificationsAsync
- [expo-image-picker official docs](https://docs.expo.dev/versions/latest/sdk/imagepicker/) — launchImageLibraryAsync, launchCameraAsync, permissions hooks, result structure
- [expo-image-manipulator official docs](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/) — context builder API, crop, resize, saveAsync
- Codebase direct reads — `user.prisma`, `enums.prisma`, `user-goal.prisma`, `userService.ts`, `r2.ts`, `env.ts`, `package.json` (all confirmed in source)
- npm registry — package versions confirmed via `npm view` on 2026-03-31

### Secondary (MEDIUM confidence)
- [Cloudflare R2 presigned URL docs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) — S3-compatible presigned PUT; verified against AWS SDK usage in codebase
- [expo/expo GitHub issue #30577](https://github.com/expo/expo/issues/30577) — confirms WeeklyTriggerInput does NOT support multiple days in a single call; one-notification-per-day is the required workaround

### Tertiary (LOW confidence)
- Community sources on React Native fetch + R2 presigned PUT binary body behavior — not officially documented; flagged as Pitfall 1 above

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages are official Expo SDK libraries or already installed; versions confirmed via npm registry
- Architecture: HIGH — patterns derived directly from official docs and existing codebase patterns
- Pitfalls: MEDIUM — presigned PUT binary body pitfall is community-verified, not official docs; all others are HIGH

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (Expo SDK docs are stable; notify if Expo SDK 55 releases before implementation)
