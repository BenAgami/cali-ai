---
name: native-code-standards
description: >
  Production-grade code standards for this Cali AI monorepo. Apply this skill
  whenever writing or reviewing ANY code in apps/native, apps/api, or packages/.
  Enforces shared types in @repo/common, service-layer architecture, thin screens,
  hook orchestration, zero hardcoded values, no secrets, no deprecated React Native
  APIs, and strict TypeScript. Trigger on any new file, feature, refactor, or code
  review in this repo — especially when creating components, hooks, services,
  API routes, or types.
---

# Cali AI — Production Code Standards

This is how we write code here. Every rule exists because violating it has a cost — duplicated types drift apart, fat screens become untestable, hardcoded URLs break in every environment. Read this once and internalize it.

---

## Mental Model: Layers and Ownership

```
@repo/common          ← types, schemas, enums, validation — the contract between all apps
apps/api              ← route → controller → service → Prisma (no leakage between layers)
apps/native
  app/(screens)/      ← JSX only. Receives props. Calls nothing directly.
  src/hooks/          ← state, effects, orchestration. One concern per hook.
  src/services/       ← all API calls. Wraps apiClient. Returns typed data.
  src/lib/api.ts      ← the HTTP primitive. Used only by services.
  src/types/          ← LOCAL-ONLY types (UI state, component props). NOT domain models.
packages/database     ← Prisma schema + generated client. No business logic.
```

**The test:** if you can't answer "which layer owns this?" in 2 seconds, the structure is wrong.

---

## Rule 1 — Shared Types Live in @repo/common

Domain models, API response shapes, request bodies, and enums are defined **once** in `packages/common/src/` and imported everywhere. There is no reason for the same shape to exist in both `apps/api` and `apps/native`.

**What goes in @repo/common:**
- Zod schemas + their inferred types (`z.infer<typeof schema>`)
- API response shapes (what the server returns, what the client receives)
- Domain enums (`ExperienceLevel`, `GoalType`, `ProcessingStatus`)
- Validation error messages (already in `packages/common/src/constants/messages.ts`)

**What stays local to apps/native/src/types/:**
- UI-only state shapes (form drafts, local component state interfaces)
- Props interfaces that don't cross the API boundary

### Example: The violation and the fix

The `UserProfile` type currently lives in `apps/native/src/types/user.ts`. It is a server response shape — the API defines it, the client consumes it. It belongs in `@repo/common`.

```ts
// WRONG — apps/native/src/types/user.ts
export type UserProfile = {
  uuid: string;
  username: string;
  experienceLevel: string; // <-- also wrong: use the enum
  goals: Goal[];
};

// RIGHT — packages/common/src/validations/user.ts (or a new responses.ts)
export const userProfileSchema = z.object({
  uuid: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  avatarUrl: z.string().url().nullable(),
  experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  goals: z.array(goalSchema),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

// In apps/native — just import it:
import type { UserProfile } from "@repo/common";
```

**Add new schemas to `packages/common/src/` and re-export from `packages/common/src/index.ts`.**
After adding, run: `yarn workspace @repo/common build` to regenerate.

---

## Rule 2 — Every API Call Has a Service

`apps/native/src/lib/api.ts` is the HTTP primitive. It is not called from hooks, components, or screens. It is called **only** from `apps/native/src/services/`.

Services are thin wrappers that:
1. Call `apiClient` with the correct path + token
2. Return a typed value using a type from `@repo/common`
3. Do nothing else — no state, no side effects, no UI logic

```ts
// apps/native/src/services/userService.ts
import { apiClient } from "@src/lib/api";
import type { UserProfile } from "@repo/common";
import { USER_ROUTES } from "@src/constants/routes";

export const userService = {
  getMe: (token: string): Promise<UserProfile> =>
    apiClient.get<UserProfile>(USER_ROUTES.me, token),

  updateProfile: (token: string, data: UpdateProfileValues): Promise<UserProfile> =>
    apiClient.patch<UserProfile>(USER_ROUTES.me, data, token),
};
```

**Services never:**
- Import React or hooks
- Hold state
- Call `router`
- `console.log`

---

## Rule 3 — Hooks Orchestrate

Hooks in `apps/native/src/hooks/` own all data fetching, loading/error state, and side effects. They call services, not `apiClient`. They return exactly what their consumer needs — no more.

```ts
// apps/native/src/hooks/useProfile.ts
import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useAuth } from "@src/context/AuthContext";
import { userService } from "@src/services/userService";
import { ApiError } from "@src/lib/api";
import type { UserProfile } from "@repo/common";

export function useProfile() {
  const { token } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!token) { router.replace("/(auth)/login"); return; }
    setLoading(true);
    setError(null);
    try {
      setUser(await userService.getMe(token));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/(auth)/login");
        return;
      }
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchUser(); }, [fetchUser]));

  return { user, loading, error };
}
```

**One hook, one concern.** If a hook is managing both profile data AND goal mutations, split it.

### When to Use TanStack Query (`useQuery` / `useMutation`)

Use TanStack Query instead of manual `useState`/`useEffect` patterns when any of these apply:

- The data is **read-heavy and benefits from caching** (e.g. user profile, exercise list)
- You need **background refetch**, stale-while-revalidate, or window-focus refresh
- You need **pagination or infinite scroll** (`useInfiniteQuery`)
- You need a **mutation with automatic cache invalidation** (`useMutation` + `queryClient.invalidateQueries`)
- You want **deduplication** of parallel fetches to the same endpoint

Stick to manual `useState` + `useCallback` for:
- Fire-and-forget side effects (e.g. logging an event)
- Streaming/SSE data that doesn't fit the request-response model
- Local UI state that never touches the network

**The service layer is unchanged.** Services return typed promises — `useQuery` just calls them.

```ts
// apps/native/src/hooks/useProfile.ts — TanStack Query version
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@src/context/AuthContext";
import { userService } from "@src/services/userService";
import type { UserProfile } from "@repo/common";

export function useProfile() {
  const { token } = useAuth();

  return useQuery<UserProfile, Error>({
    queryKey: ["profile", token],
    queryFn: () => userService.getMe(token!),
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 min — don't refetch if still fresh
  });
}

// Screen consumes it the same way:
const { data: user, isLoading, error } = useProfile();
```

```ts
// Mutation with cache invalidation
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "@src/services/userService";

export function useUpdateProfile() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileValues) =>
      userService.updateProfile(token!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
```

**Query key conventions:**
- First element is the resource name: `["profile"]`, `["sessions"]`, `["exercises"]`
- Add scoping params after: `["sessions", sessionId]`, `["profile", token]`
- Keep keys in a constants file when they're shared across hooks:

```ts
// apps/native/src/constants/queryKeys.ts
export const QUERY_KEYS = {
  profile: (token: string) => ["profile", token] as const,
  sessions: () => ["sessions"] as const,
  session: (id: string) => ["sessions", id] as const,
} as const;
```

**Never** call `queryClient` directly from a screen or component. Invalidation logic belongs in the `onSuccess`/`onError` callbacks of `useMutation`, inside the hook.

---

## Rule 4 — Screens Are Thin

A screen file contains JSX and wiring. It does not contain:
- `try/catch` blocks
- `async` functions beyond trivial event handlers
- Direct `apiClient` or `fetch` calls
- Business logic of any kind
- State beyond what's local to the UI (modals open/closed, tab selected)

```tsx
// WRONG — screen doing business logic
const ProfileScreen = () => {
  const [user, setUser] = useState(null);
  const { token } = useAuth();

  useEffect(() => {
    apiClient.get("/api/users/me", token).then(setUser); // direct API call
  }, [token]);

  return <View>...</View>;
};

// RIGHT — screen just renders
const ProfileScreen = () => {
  const { user, loading, error } = useProfile(); // hook owns the data

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  return <ProfileView user={user} />;
};
```

---

## Rule 5 — No Hardcoded Values

**No magic strings. No inline numbers. No hardcoded URLs.**

### API Base URL

`API_BASE` in `apps/native/src/lib/api.ts` must come from an environment variable, not a string literal.

```ts
// WRONG
export const API_BASE = "http://<host>:<port>"; // hardcoded URL in committed source

// RIGHT — apps/native/src/lib/api.ts
import Constants from "expo-constants";
const API_BASE = Constants.expoConfig?.extra?.apiBaseUrl;
if (!API_BASE) throw new Error("API_BASE not configured in app.json > extra");
// Set in app.json > extra > apiBaseUrl, populated from .env (gitignored) per environment
```

### Route Paths

API paths are constants, not inline strings.

```ts
// apps/native/src/constants/routes.ts
export const USER_ROUTES = {
  me: "/api/users/me",
  login: "/api/users/login",
  register: "/api/users/register",
} as const;

// Usage
apiClient.get<UserProfile>(USER_ROUTES.me, token);
```

### Theme Values

No raw hex colors or pixel values inline in component styles. Use tokens from `apps/native/src/theme/`.

```ts
// WRONG
style={{ color: "#E57373", fontSize: 13 }}

// RIGHT
import { colors, typography } from "@src/theme";
style={{ color: colors.error, fontSize: typography.sm }}
```

---

## Rule 6 — No Secrets in Code

Never hardcode API keys, auth tokens, credentials, or service URLs in source files. This includes `.ts`, `.tsx`, `.json`, and config files committed to the repo.

**The pattern:**
1. Add the variable to `apps/native/.env` (gitignored)
2. Expose it via `app.json` → `extra` → accessed via `expo-constants`
3. Or for server-side: add to `apps/api/src/config/env.ts` with a Zod schema entry

```ts
// apps/api/src/config/env.ts — the only place process.env is read
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  REDIS_URL: z.string().url(),
  // new vars go here, never read process.env directly elsewhere
});
```

If you're writing a URL, key, or token as a string literal — stop. Put it in `.env`.

---

## Rule 7 — No Deprecated React Native / Expo APIs

This project targets **Expo SDK 54** and modern React Native. Use current APIs.

| Deprecated | Use Instead |
|---|---|
| `TouchableOpacity` | `Pressable` |
| `TouchableHighlight` | `Pressable` |
| `TouchableNativeFeedback` | `Pressable` |
| `ActivityIndicator` from `react-native` in new UI | Keep using it — it's fine |
| `StyleSheet.create` with magic values | `StyleSheet.create` + theme tokens |
| `AsyncStorage` from `@react-native-async-storage/async-storage` without error handling | Always wrap with try/catch |
| `console.log` left in committed code | Remove or use a proper logger |
| `useNavigation()` for push/replace | `router` from `expo-router` |

```tsx
// WRONG — in login.tsx
<TouchableOpacity onPress={handleSubmit} activeOpacity={0.8}>
  ...
</TouchableOpacity>

// RIGHT
<Pressable onPress={handleSubmit} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
  ...
</Pressable>
```

---

## Rule 8 — Type Safety Throughout

**No `any`. No unnarrowed `unknown`. No `as T` without proof. No `Function` type.**

```ts
// WRONG
const handler = (err: any) => console.log(err.message);
const fn: Function = () => {};
const data = response as UserProfile; // no validation

// RIGHT
const handler = (err: unknown) => {
  if (err instanceof Error) console.log(err.message);
};
const fn = (x: string): void => {};
const data = userProfileSchema.parse(response); // validated, then typed
```

Props interfaces are always explicit — never use `any` or `object` as a prop type.

```ts
// WRONG
const ProfileCard = ({ user }: any) => ...;

// RIGHT
interface ProfileCardProps {
  user: UserProfile;
  onEditPress: () => void;
}
const ProfileCard = ({ user, onEditPress }: ProfileCardProps) => ...;
```

Enums from `@repo/common` schemas eliminate stringly-typed fields:

```ts
// WRONG
experienceLevel: string; // "BEGINNER" | "INTERMEDIATE" | "ADVANCED" — but invisible

// RIGHT — define once in @repo/common
export const EXPERIENCE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type ExperienceLevel = typeof EXPERIENCE_LEVELS[number];
// Use everywhere: experienceLevel: ExperienceLevel
```

---

## API Layer (apps/api) — Same Rules Apply

The server follows three-tier: **route → controller → service → Prisma**.

- Controllers never touch Prisma directly
- Services never import from route files
- All request bodies validated in middleware via `@repo/common` Zod schemas before reaching controllers
- All async handlers wrapped with `asyncWrapper` from `apps/api/src/utils/asyncWrapper.ts`
- Throw typed errors (`NotFoundError`, `UnauthorizedError`) from `apps/api/src/errors/` — never `res.status(404).json(...)`
- New environment variables → add to `apps/api/src/config/env.ts` schema, never read `process.env` elsewhere

---

## Checklist — Apply Before Writing Any Code

Before writing any code, answer these:

- [ ] Is this type defined in `@repo/common` if it crosses the API boundary?
- [ ] Does this API call go through a service in `src/services/`?
- [ ] Does this hook call a service, not `apiClient` directly?
- [ ] Should this hook use `useQuery`/`useMutation` (cached read or invalidation needed) rather than manual `useState`/`useEffect`?
- [ ] Are query keys consistent with `QUERY_KEYS` constants and scoped correctly?
- [ ] Is this screen JSX-only with no business logic?
- [ ] Are all strings/numbers/URLs/colors coming from constants or env?
- [ ] Are there any secrets, tokens, or credentials hardcoded?
- [ ] Am I using `Pressable` instead of `TouchableOpacity`?
- [ ] Does every prop have an explicit TypeScript interface?
- [ ] Is there any `any`, unnarrowed `unknown`, or unsafe `as` cast?
- [ ] Did I leave any `console.log` in committed code?
