# Pitfalls Research

**Domain:** Mobile calisthenics app with AI video form analysis (React Native / Expo + Express + PostgreSQL)
**Researched:** 2026-03-21
**Confidence:** HIGH (architecture/mobile pitfalls) | MEDIUM (AI pipeline specifics)

---

## Critical Pitfalls

### Pitfall 1: Expo Managed Workflow Is Incompatible with On-Device ML Libraries

**What goes wrong:**
The project uses Expo managed workflow. `@tensorflow/tfjs-react-native` requires native modules (`expo-gl`, `expo-gl-cpp`, `react-native-fs`) that are either outdated relative to current Expo SDK versions or do not work in the managed workflow at all. Attempting to run MediaPipe or TensorFlow.js for on-device real-time pose estimation inside Expo managed will produce runtime errors like `TypeError: null is not an object (evaluating 'RNFSManager.RNFSFileTypeRegular')` or build failures due to incompatible unimodule versions. GitHub issue #30060 on the Expo repo documents a direct incompatibility between `expo-camera` and `@tensorflow/tfjs-react-native` in Expo SDK 51+.

**Why it happens:**
Developers assume the Expo managed workflow is a thin wrapper over React Native. In practice, the managed workflow abstracts native code and locks the native module surface to the Expo SDK version — any library requiring custom native code or a non-standard version of `expo-gl` will fail. The team has not yet ejected (the project is still on managed workflow per `PROJECT.md`).

**How to avoid:**
Decide the AI execution strategy before writing any native camera or ML code:
- **Option A (Recommended for MVP):** Keep managed workflow, send video frames or the full video to the backend for cloud-based pose estimation. No native ML libraries required on device. Real-time feedback arrives via WebSocket or polling.
- **Option B (Real-time on-device):** Eject to Expo bare workflow (or use a development build with `expo-dev-client`) before integrating any ML library. Do this at the start of the real-time analysis phase, not mid-development.
- **Never** attempt to add `@tensorflow/tfjs-react-native` or MediaPipe React Native packages to a managed Expo app without first testing the specific SDK version combination in isolation.

**Warning signs:**
- `expo install` suggests conflicting peer dependency versions for a pose estimation package
- Build errors mentioning `RNFSManager`, `expo-gl-cpp`, or unimodule version mismatches
- The library's README says "bare workflow only" or "eject required"

**Phase to address:**
AI pipeline architecture decision phase — before any ML code is written.

---

### Pitfall 2: Real-Time Pose Inference Kills Battery and Triggers Thermal Throttling

**What goes wrong:**
Running continuous frame-by-frame pose inference (even at 15–30 FPS) causes the device CPU/GPU to sustain near-100% utilization. On mid-range Android devices, this causes: (1) battery drain 3–5x normal rate during a workout, (2) device temperature reaching 38°C+ within 5–10 minutes, at which point iOS and Android both throttle the processor — causing visible lag, dropped frames, and degraded model accuracy. Users doing a 20-minute workout will drain 30–50% of their battery and may have a device too hot to hold.

**Why it happens:**
Developers test real-time inference on a recent flagship device on a USB charger. The model hits 30 FPS easily. They ship. Mid-range devices (the majority of the user base), unplugged, hit thermal limits within a single exercise set.

**How to avoid:**
- Cap inference rate to 8–10 FPS for real-time cues — human perception of "live" feedback does not require 30 FPS; significant quality-of-life improvement for only 1/3 the compute cost.
- Use a frame skip strategy: only run inference on every Nth frame, interpolate landmarks between runs.
- If doing cloud inference for real-time, send compressed JPEG frames at reduced resolution (e.g., 480p) rather than full camera output.
- Display a battery/thermal warning if `expo-battery` reports thermal state as `OVERHEAT`.
- Test specifically on a mid-range Android device (e.g., Snapdragon 600-series) unplugged for 15 minutes before considering real-time mode complete.

**Warning signs:**
- Device gets warm during development testing
- FPS drops from 30 to 10 after 3–5 minutes on device
- `expo-battery` thermal state returns `WARM` or `OVERHEAT`

**Phase to address:**
Real-time AI form analysis phase — enforce frame rate cap in the first working implementation.

---

### Pitfall 3: Horizontal Exercise Positions Break Pose Detection (Push-Ups, Dips)

**What goes wrong:**
MediaPipe BlazePose and ML Kit Pose Detection are both trained predominantly on upright standing figures. When a user is horizontal (push-up bottom position) or at unusual angles (dip bottom, inverted hang), the model produces a significant number of incorrect keypoint placements — limb direction flips, depth estimation errors, and landmarks placed on incorrect body parts. The InfoQ analysis of pose estimation in fitness apps explicitly identifies push-ups in horizontal positions as a high-error scenario. For a calisthenics app where push-ups are one of four core exercises, this is not an edge case — it is a primary use case.

**Why it happens:**
Teams validate pose detection by testing the user standing in front of the camera. The model performs acceptably. They assume it generalizes to exercise positions. It does not.

**How to avoid:**
- Validate pose estimation accuracy specifically for each of the four target exercises (push-ups, pull-ups, dips, squats) before committing to any particular model.
- For push-ups: test detection accuracy in both the up position and the down (chest-near-floor) position; rotate the video frame to portrait orientation before inference if the camera is mounted sideways.
- Set exercise-specific confidence thresholds: if keypoint confidence scores fall below 0.6 for critical joints, show "can't see your form clearly — adjust your camera" rather than producing incorrect feedback.
- Pull-ups are particularly prone to occlusion (hands on bar, arms overhead) — validate the grip position frame explicitly.

**Warning signs:**
- Demo videos all show the user standing or squatting upright, never prone or inverted
- Keypoint confidence scores below 0.5 during any test for push-up bottom position
- Form feedback inverts (calling a correct rep "incorrect") during certain phases of the movement

**Phase to address:**
AI pipeline validation phase — include exercise-specific accuracy tests as acceptance criteria before user-facing rollout.

---

### Pitfall 4: Video Upload Fails Silently on iOS When App Is Backgrounded

**What goes wrong:**
A workout video (30–90 seconds at 1080p) is typically 50–200 MB. If the user films a set and immediately backgrounds the app (locks phone, switches apps), iOS suspends the JavaScript thread. A standard `fetch()` or `XMLHttpRequest` upload in React Native is terminated by the OS. The user returns to find either a frozen upload progress bar or no feedback at all. The backend receives a partial file and the session stays in `PROCESSING` state permanently — never transitioning to `COMPLETED` or `FAILED`.

**Why it happens:**
Standard `fetch()` uploads work perfectly when the app is foregrounded during the entire test. Mobile developers test this way and ship. Users lock their phones during the post-set rest period, which is exactly when the upload is in progress.

**How to avoid:**
- Use `react-native-background-upload` (iOS NSURLSession-based) which continues uploads after the app is backgrounded because it delegates to the OS networking stack, not the JS thread.
- Alternatively: compress video to 480p before upload (reduces file size 10–20x), so uploads complete in seconds while the app is still foregrounded.
- Implement a session status polling mechanism: the app checks `GET /api/sessions/:id` on return from background and surfaces the current `processingStatus` to the user.
- On the backend, implement a timeout job: sessions stuck in `PROCESSING` for more than 10 minutes should transition to `FAILED` with a retriable flag.

**Warning signs:**
- Sessions accumulate in `PROCESSING` state in the database
- Upload progress bar freezes at a random percentage when the phone is locked
- No error is surfaced to the user after a failed upload

**Phase to address:**
Video upload and post-set analysis phase — use background-safe upload library from day one.

---

### Pitfall 5: AI Form Feedback That Is Always Negative Destroys User Retention

**What goes wrong:**
Developers optimize the AI to detect form errors (the "interesting" signal). The model gets good at finding what's wrong. Shipped to users, every set receives 3–5 corrections: "your hips are too low," "elbows flaring," "incomplete range of motion." Users who are performing reasonably well get the same critical feedback as beginners. After 3 sessions, users report the app as demoralizing and stop filming. High churn directly from the AI product feature that was supposed to drive retention.

**Why it happens:**
Error detection is easier to build and measure than positive reinforcement. The engineering team optimizes for what they can validate. "No errors found" feels like a bug, so the threshold for flagging is set low.

**How to avoid:**
- Balance the feedback ratio: for any given set, lead with what the user did well before listing corrections. If all major form points are acceptable, say so explicitly ("good depth on all reps, elbows tracking well").
- Implement a confidence threshold for flagging: only surface a correction if the model confidence for that error exceeds 0.75. Below that, suppress it.
- Limit corrections per set to a maximum of 2 — the most impactful issues only. A list of 5 corrections is impossible to act on during the next set.
- For returning users, compare against their own previous sessions ("your elbow flare improved 20% since last week"), not against an absolute ideal standard.

**Warning signs:**
- Every test set of "correct" form receives multiple corrections during internal testing
- There is no code path that produces a purely positive feedback response
- Feedback strings contain no positive language

**Phase to address:**
AI feedback delivery phase — define feedback format and tone guidelines before writing the Claude prompt.

---

### Pitfall 6: LLM-Generated Workouts Prescribe Unsafe Progressions

**What goes wrong:**
Claude is given a user's goal ("I want to do a muscle-up in 3 months") and generates a workout plan that includes exercises the user is not ready for (heavy ring dips in week 1), inappropriate volume (5 sets of max pull-ups every day), or no rest days. PubMed research on LLMs in exercise prescription (PMC12133071) explicitly identifies this pattern: general-purpose LLMs produce plans that are "overly strenuous for individuals with chronic conditions" or without fitness baseline information. For calisthenics, where progressions are highly skill-dependent (e.g., you cannot safely do a muscle-up without prerequisite scapular strength), an incorrect progression plan can cause injury and liability exposure.

**Why it happens:**
LLMs are optimized to produce plausible, confident-sounding responses. A workout plan that sounds well-structured will pass a casual review even if the progressions are unsafe. Developers test with "beginner push-up plan" and it looks fine; they don't test with edge cases like "I want to do a one-arm pull-up this week."

**How to avoid:**
- Constrain the workout generator to the seeded exercise catalog — the LLM cannot invent exercises not in the database. Use structured output (JSON schema with exercise codes from the catalog).
- Include a system prompt that enforces progressive overload rules: max 10% volume increase week-over-week, mandatory rest days, no plyometric or advanced skill exercises in beginner plans.
- Add a disclaimer UI component on every AI-generated plan: "Always consult a fitness professional before starting a new program."
- Validate generated JSON against a Zod schema server-side before returning it; if the schema fails, return an error rather than malformed data.
- Log all generated plans for audit — do not store them as immutable records without any review mechanism.

**Warning signs:**
- The LLM includes exercises not in the catalog (hallucinated exercise names)
- Generated plans have no rest days
- Volume numbers exceed safe daily maxima (e.g., "100 push-ups, 5 sets, daily")

**Phase to address:**
AI workout generation phase — structured output constraints and system prompt safety rules are required before beta access.

---

### Pitfall 7: The `processingStatus` Field Never Advances Beyond `PENDING`

**What goes wrong:**
The existing `WorkoutSession` schema has `processingStatus` with states `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`. The current code creates sessions in `PENDING` and never transitions them — this is explicitly documented in `CONCERNS.md`. If the AI pipeline is built without a robust state machine for this field, edge cases accumulate: network failure mid-upload leaves sessions in `PROCESSING` forever; the AI service crashes and sessions never reach `COMPLETED`; the client polls indefinitely with no timeout. The client-facing experience is a spinner that never resolves.

**Why it happens:**
The happy path (upload succeeds, AI responds, status transitions to `COMPLETED`) is built and tested. Failure paths are not. Background jobs to clean up stuck sessions are never written because "we'll add that later."

**How to avoid:**
- Implement the full state machine in the first iteration of the video upload endpoint: `PENDING` → `PROCESSING` (upload received) → `COMPLETED` (AI response stored) → `FAILED` (any error, with `errorCode` field).
- Add a server-side timeout: a cron job (or Prisma scheduled query) marks sessions still in `PROCESSING` after 10 minutes as `FAILED` with code `TIMEOUT`.
- The client must handle all four states explicitly in the UI: polling with exponential backoff for `PROCESSING`, clear error message with retry option for `FAILED`.
- Never expose a session to the user without a status indicator.

**Warning signs:**
- Any session in the database has `processingStatus = 'PROCESSING'` for longer than 10 minutes
- The API returns a session object without a `processingStatus` field to the client
- The client has no UI state for `FAILED` status

**Phase to address:**
Video upload phase — implement the complete state machine before any AI integration work.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Synchronous AI processing (inline in request handler) | Simpler code, no queue needed | Request timeout on large videos; server blocks during AI call; no retry on failure | Never for production; acceptable for local proof-of-concept only |
| Storing full video on Express server filesystem | No S3 setup required | Disk fills up; videos lost on server restart; no CDN; no resumable uploads | Only if CDN is explicitly deferred (as noted in PROJECT.md) — must add cleanup job |
| Hardcoded exercise-to-prompt mapping | Fast to ship first 4 exercises | Every new exercise requires a code deploy | Acceptable for MVP of 4 exercises; must externalize before catalog expansion |
| Single confidence threshold across all exercises | One config value | Push-ups require different thresholds than squats (horizontal vs vertical) | Never — set per-exercise thresholds from the start |
| Polling for AI results (client-side) | No WebSocket infrastructure | Battery drain from polling loop; poor UX for fast results | Acceptable for post-set analysis; not acceptable for real-time feedback |
| `any` type on error handler (existing) | Avoids refactoring | Runtime errors from Prisma shape changes (documented in CONCERNS.md) | Never — fix this before AI errors are introduced |
| `BigInt` manual serialization per field (existing) | Works for current fields | Every new BigInt field requires manual handling; silent precision loss above MAX_SAFE_INTEGER | Never — add a global JSON replacer |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude API for form feedback | Sending raw pose landmark coordinates to Claude and expecting it to interpret them | Convert landmarks to human-readable joint angles and relative positions before sending; Claude reasons better over "elbow angle 95 degrees" than over `[{x: 0.42, y: 0.31, z: -0.05, visibility: 0.97}]` |
| Claude API for workout generation | Freeform text response that must be parsed | Use `response_format` structured output or a strict JSON schema in the prompt; validate against Zod on receipt; never trust free-text exercise names |
| MediaPipe / ML Kit on Android | Assuming all Android devices have a GPU available for model acceleration | Always provide a CPU fallback delegate; test on low-end devices (Snapdragon 400-series) where GPU acceleration may be absent or slower than CPU |
| `expo-camera` for filming | Using the camera API that changed in Expo SDK 50+ (CameraView vs Camera component) | Confirm which `expo-camera` API version aligns with Expo SDK 54 (the project's SDK); the old `Camera` component was deprecated |
| Multipart video upload | Using `fetch()` for large files | Use `react-native-background-upload` which delegates to `NSURLSession` on iOS and `OkHttp` on Android; survives app backgrounding |
| Prisma + AI service errors | Catching all errors as `any` (already a concern in CONCERNS.md) | Use `Prisma.PrismaClientKnownRequestError` for Prisma errors and a typed `AIServiceError` class for AI pipeline errors; never use `catch (e: any)` |
| PostgreSQL connection pool under video load | Using default Prisma connection pool (10 max) during burst of simultaneous video analyses | Configure explicit pool size in `PrismaPg` init; add `connectionTimeoutMillis` to avoid hanging requests |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Storing video files in memory before upload | App crash on upload for videos >100 MB; OOM errors on Android | Stream video directly from file URI to upload; never `readAsBase64` a full video into JS memory | Any video longer than ~30 seconds on a mid-range device |
| Fetching all sessions without pagination for progress graph | Progress screen hangs for users with 100+ sessions; API response takes 2–5 seconds | Paginate session history; aggregate statistics server-side (store running averages); never send raw session list to client for client-side charting | ~50+ sessions per user |
| Real-time pose inference at full camera resolution | Sustained 30+ FPS inference at 1080p kills battery in under 5 minutes | Downscale camera preview to 480p or 360p for inference; display full-res preview separately if needed | Immediately, on any mid-range device |
| Running AI feedback generation synchronously per rep | Each rep triggers an AI API call; 10 reps = 10 sequential API calls | Batch landmark data for the entire set; send one request after set completion for post-set analysis; for real-time, aggregate cues and send max once per 2 seconds | First time a set has more than 3 reps |
| No index on `processingStatus` for stuck session cleanup job | Cleanup cron job does a full table scan on `workout_sessions` as session count grows | Add `idx_sessions_processing_status` on `(processing_status, updated_at)` during schema migration for the video upload feature | ~10,000 sessions in database |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting video uploads without file type validation | Attacker uploads non-video files (executables, malicious archives) disguised as `.mp4`; server processes them through the AI pipeline | Validate MIME type server-side using magic bytes (not just file extension); use `file-type` npm package; reject anything that is not a valid video container |
| No file size limit on video upload endpoint | DoS via uploading multi-GB files; disk exhaustion | Set `multer` `limits.fileSize` to a reasonable max (e.g., 500 MB for a single set); return 413 with a clear message |
| Storing AI form analysis results without user scoping | User A can fetch User B's form analysis by guessing session IDs | All AI result retrieval endpoints must enforce `WHERE user_id = req.user.id AND session_id = :id`; never fetch by session ID alone |
| Sending raw video to Claude Vision | High token cost; privacy exposure of user biometrics in plaintext to a third-party API | Use pose landmark extraction locally or via a dedicated vision model first; send only structured landmark/angle data to Claude for text generation |
| CORS wildcard with credentials (existing) | Any website can make authenticated API calls on behalf of logged-in users | Fix `origin: true` to an explicit allowlist before any public deployment (documented in CONCERNS.md) |
| No rate limit on video upload endpoint | User programmatically submits hundreds of videos, exhausting AI API quota and storage | Apply per-user rate limit (e.g., max 20 video uploads per hour) using `express-rate-limit` keyed by `req.user.id` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Requiring camera permission before showing any value | Users decline camera permission before understanding why it's needed; iOS only allows one permission prompt attempt | Show a "what you'll get" screen with an example form analysis result before triggering the camera permission dialog; explain exactly what the camera is used for |
| Showing a skeleton overlay on the live camera view with no explanation | Users are confused by the wireframe body appearing over them; they think the app is broken | Show a brief onboarding animation of what the skeleton means and that it confirms "the AI can see you" before the first set |
| Delivering 5+ form corrections after a single set | User cannot act on 5 corrections during the next set; feels defeated | Cap visible corrections at 2 per set (the highest-confidence ones); surface the rest in a "detailed analysis" collapsed section |
| No feedback when AI analysis is in progress | User taps "analyze" and sees nothing for 5–15 seconds; taps again; submits duplicate requests | Show an animated processing state immediately on upload; give a time estimate ("usually 10–15 seconds"); disable the submit button after first tap |
| Form score displayed without context | A score of "72/100" means nothing to a user; they don't know if that's good, bad, or typical | Show the score alongside a personal trend ("up 8 points from last week") and a benchmark ("top 40% of users at this exercise") |
| Camera setup instructions are text-only | User puts phone in wrong position for accurate detection (too close, wrong angle); all feedback is wrong | Show a live silhouette overlay guide: "move back until your full body fits in the frame" with real-time fit validation before starting the set |
| Real-time audio cues without volume control | Audio cues interrupt music; users working out with headphones get jarring interruptions | Respect system silent mode; provide a dedicated in-app toggle for audio cues vs. haptic-only cues |

---

## "Looks Done But Isn't" Checklist

- [ ] **Video upload:** Appears to work in tests but uses `fetch()` — verify it survives app backgrounding by locking the phone immediately after starting an upload.
- [ ] **Form analysis:** Model runs and returns data — verify it produces correct results specifically for push-up down-position and pull-up top-position (the high-occlusion frames for each exercise).
- [ ] **Session status:** Sessions transition through all four states — verify a simulated AI service failure produces `FAILED` status and the client surfaces a retry option (not a frozen spinner).
- [ ] **AI workout generation:** Returns a valid JSON plan — verify the output is validated against the exercise catalog (no hallucinated exercise codes), contains rest days, and does not exceed safe volume.
- [ ] **Progress tracking:** Charts render — verify they do not make unbounded API calls for users with large session histories; confirm server-side aggregation is in place.
- [ ] **Camera permission:** Permission dialog triggers — verify behavior on iOS when permission was previously denied (must link to Settings; cannot re-prompt).
- [ ] **Auth token expiry:** JWTs work during a session — verify behavior when a token expires mid-workout (1h default): the app must prompt re-login without silently losing workout data.
- [ ] **Expo SDK compatibility:** ML library installs without errors — verify on both iOS and Android simulator with `expo-camera` at Expo SDK 54 before committing to the library choice.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Expo managed workflow incompatible with chosen ML library | HIGH | Eject to bare workflow (1–3 days); audit all existing Expo managed APIs for compatibility; re-test entire app; update CI build configuration |
| Stuck sessions in `PROCESSING` state in production | MEDIUM | Write a one-time migration script to mark all sessions older than 10 minutes with `PROCESSING` as `FAILED`; add the cleanup cron job; notify affected users via in-app message |
| LLM generating unsafe workout plans discovered post-launch | HIGH | Disable AI workout generation feature flag immediately; audit all generated plans in the database; implement structured output constraints and re-enable; add legal disclaimer |
| Pose model producing consistently wrong feedback for one exercise | MEDIUM | Disable AI analysis for that specific exercise code (use the existing `active` flag pattern); surface manual logging as fallback; retune thresholds or switch model for that exercise |
| Video files accumulating on server disk (no CDN) | MEDIUM | Add a cleanup job to delete videos after analysis is complete; set storage quotas per user; implement pre-signed upload URLs to S3 if storage becomes critical |
| User loses workout data due to token expiry mid-session | LOW | Store workout session state in AsyncStorage/SecureStore locally; sync to backend on next valid auth; never rely solely on server-side session state for in-progress workouts |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Expo managed workflow incompatibility with ML libraries | AI pipeline architecture decision (before any ML code) | Library installs and runs on both simulators without errors |
| Real-time inference battery and thermal drain | Real-time AI phase | 15-minute sustained workout on mid-range Android device, unplugged, stays below thermal warning |
| Horizontal exercise pose detection failures | AI pipeline validation phase | Exercise-specific accuracy test suite includes push-up down-position and pull-up top-position frames |
| Video upload backgrounding failure on iOS | Video upload phase | Upload survives immediate phone lock; `processingStatus` advances correctly |
| Always-negative AI feedback destroying retention | AI feedback delivery phase | Internal test: correct-form video of all 4 exercises receives at least one positive feedback item |
| LLM generating unsafe workout progressions | AI workout generation phase | Generated plan JSON validates against Zod schema; no exercise codes outside the catalog; volume within safe limits |
| `processingStatus` stuck in PROCESSING forever | Video upload phase (before AI integration) | Simulated AI failure produces `FAILED` status within 10 minutes; client renders retry UI |
| Video stored on server disk without cleanup | Video upload phase | Cleanup job deletes video file after analysis completes; storage does not grow unboundedly after 100 test sessions |
| CORS wildcard with credentials (existing) | Pre-deployment security hardening phase | `origin: true` replaced with explicit allowlist before any public URL is shared |
| Oversized feedback list per set | AI feedback prompt design phase | No feedback response contains more than 2 corrections; positive acknowledgment present when form is acceptable |

---

## Sources

- [MediaPipe Pose Estimation for Sports Apps — IT-Jim](https://www.it-jim.com/blog/mediapipe-for-sports-apps/) — MEDIUM confidence (vendor blog, technically specific)
- [Challenges of Human Pose Estimation in AI-Powered Fitness Apps — InfoQ](https://www.infoq.com/articles/human-pose-estimation-ai-powered-fitness-apps/) — MEDIUM confidence
- [TensorFlow.js React Native + Expo managed workflow incompatibility — GitHub Issue #2729](https://github.com/google/mediapipe/issues/1838) — HIGH confidence (official repo issue)
- [expo-camera / tfjs-react-native incompatibility in Expo SDK 51 — GitHub Issue #30060](https://github.com/expo/expo/issues/30060) — HIGH confidence (official repo issue)
- [Large media asset uploading in React Native with retry — Medium](https://ahartzog.medium.com/large-media-asset-uploading-with-react-native-multipart-with-retry-handling-22d0dc3cd94b) — MEDIUM confidence
- [react-native-background-upload — GitHub (Vydia)](https://github.com/Vydia/react-native-background-upload) — HIGH confidence (library documentation)
- [Using LLMs to Enhance Exercise Recommendations — PMC/PubMed](https://pmc.ncbi.nlm.nih.gov/articles/PMC12133071/) — HIGH confidence (peer-reviewed)
- [5 Common UX Mistakes in AI Products — Rival Design](https://withrival.com/blog/5-common-ux-mistakes-in-ai-products-and-how-to-solve-them) — LOW confidence (agency blog)
- [Why Fitness Apps Fail — Apidots](https://apidots.com/blog/why-fitness-apps-fail-and-how-to-build-successful-fitness-apps/) — LOW confidence (vendor content)
- [AI Power Drain and Battery Limits — Enovix](https://enovix.com/the-ai-power-drain-why-battery-limitations-threaten-the-future-of-mobile-ai/) — MEDIUM confidence (hardware manufacturer)
- Existing codebase: `.planning/codebase/CONCERNS.md` — HIGH confidence (direct code audit)

---
*Pitfalls research for: Mobile calisthenics app with AI video form analysis*
*Researched: 2026-03-21*
