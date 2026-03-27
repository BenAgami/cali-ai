# Architecture Research

**Domain:** AI-powered calisthenics form analysis — mobile video capture + pose estimation + LLM feedback
**Researched:** 2026-03-21
**Confidence:** MEDIUM-HIGH

---

## Standard Architecture

### System Overview

The pipeline has two execution modes — **real-time** (on-device, during the set) and **post-set** (upload-and-analyze, after the set ends). They share the same pose estimation layer but diverge in where feedback is generated and how it is delivered.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         apps/native (React Native / Expo)                    │
│                                                                              │
│  ┌──────────────┐   ┌────────────────────┐   ┌──────────────────────────┐   │
│  │ Camera       │   │ Pose Estimation    │   │ Workout / Recording UI   │   │
│  │ (expo-camera │──▶│ Layer (on-device)  │──▶│ - Live skeleton overlay  │   │
│  │  or          │   │ TFLite MoveNet     │   │ - Rep counter            │   │
│  │  VisionCam)  │   │ Lightning          │   │ - Real-time cue banner   │   │
│  └──────────────┘   └────────┬───────────┘   └──────────────────────────┘   │
│                              │                                               │
│                         17 keypoints/frame                                   │
│                              │                                               │
│  ┌───────────────────────────▼──────────────────────────────────────────┐    │
│  │ Form Analysis Client (real-time path)                                │    │
│  │ - Angle / velocity calculation from keypoints                        │    │
│  │ - Rule engine: flag sustained deviation (>2s) → cue                  │    │
│  │ - Throttled Claude API call (optional, on sustained deviation only)  │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │ Upload Client (post-set path)                                        │    │
│  │ - Compress & trim video after set ends                               │    │
│  │ - POST /api/analysis-jobs (multipart, video + set metadata)          │    │
│  │ - SSE listener for job progress + final result                       │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         apps/api (Express 5 / Node.js)                       │
│                                                                              │
│  Routes → Controllers → Services  (existing pattern, extended)              │
│                                                                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐    │
│  │ /api/workouts   │  │ /api/analysis-   │  │ /api/progress            │    │
│  │ (CRUD, AI gen)  │  │ jobs (upload,    │  │ (session history, scores)│    │
│  │                 │  │  status, result) │  │                          │    │
│  └────────┬────────┘  └────────┬─────────┘  └──────────┬───────────────┘    │
│           │                   │                         │                   │
│           │            ┌──────▼──────────────────┐      │                   │
│           │            │ Analysis Job Service    │      │                   │
│           │            │ - save video to disk    │      │                   │
│           │            │ - enqueue BullMQ job    │      │                   │
│           │            │ - SSE stream status     │      │                   │
│           │            └──────┬──────────────────┘      │                   │
│           │                   │                         │                   │
│           │            ┌──────▼──────────────────┐      │                   │
│           │            │ Analysis Worker         │      │                   │
│           │            │ (BullMQ worker process) │      │                   │
│           │            │ 1. Extract key frames   │      │                   │
│           │            │ 2. Claude API (images + │      │                   │
│           │            │    keypoint context)    │      │                   │
│           │            │ 3. Persist feedback     │      │                   │
│           │            │ 4. Publish result event │      │                   │
│           │            └──────┬──────────────────┘      │                   │
│           │                   │                         │                   │
│  ┌────────▼───────────────────▼─────────────────────────▼───────────────┐    │
│  │                    @repo/db (Prisma 7 / PostgreSQL)                  │    │
│  │   Workout  ·  WorkoutSet  ·  AnalysisJob  ·  FormFeedback            │    │
│  │   ProgressSnapshot  ·  Exercise (existing)                           │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│              External Services                                               │
│   Claude API (Anthropic)    │    Redis (BullMQ backing store)               │
│   - Image vision endpoint   │    - Job queue persistence                    │
│   - Text generation         │    - Worker coordination                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Camera Layer | Capture video frames, give access to recorded file | `expo-camera` for post-set recording; `react-native-vision-camera` with frame processors for real-time |
| Pose Estimation Layer | Convert each camera frame to 17 body keypoints (x, y, confidence) | TFLite MoveNet Lightning on-device via `@tensorflow-models/pose-detection` + TFJS React Native adapter |
| Form Analysis Client | Calculate joint angles, flag deviation, throttle feedback calls | Custom hook in `apps/native`; uses pose stream, no server round-trip for basic cues |
| Upload Client | Compress, chunk, and POST video; subscribe to SSE for job progress | Expo FileSystem + `fetch` with FormData; `react-native-sse` for event stream |
| Analysis Job Route / Controller | Accept multipart upload, validate, return job ID immediately | New `apps/api/src/routes/analysisJob.ts` following existing route pattern |
| Analysis Job Service | Write file to disk, create DB record, enqueue BullMQ job | `apps/api/src/services/analysisJobService.ts` |
| Analysis Worker | Frame extraction, Claude API call, persist feedback, emit SSE event | Separate BullMQ worker — can run in same Node.js process or separately |
| Frame Extractor | Sample meaningful frames (e.g., every N frames or at detected reps) | `ffmpeg` via `fluent-ffmpeg` or manual sampling from video buffer |
| Claude API Client | Build multi-image message with exercise context, parse structured feedback | Thin wrapper around Anthropic SDK in `apps/api/src/services/` |
| SSE Endpoint | Stream job status updates (queued → processing → done/error) to mobile client | Express `res.write('data: ...\n\n')` with `text/event-stream` |
| AI Workout Generator | Accept goal description, return structured workout plan | Separate service calling Claude text API; no vision needed |
| @repo/db | Persist all entities: jobs, feedback records, workouts, sets, progress | Prisma 7 + PostgreSQL via existing `packages/database` |

---

## Recommended Project Structure

New additions to the existing monorepo:

```
apps/api/src/
├── routes/
│   ├── analysisJob.ts        # POST /api/analysis-jobs, GET /api/analysis-jobs/:id/stream
│   ├── workout.ts            # POST /api/workouts (manual + AI-generated)
│   └── progress.ts           # GET /api/progress
├── controllers/
│   ├── analysisJobController.ts
│   ├── workoutController.ts
│   └── progressController.ts
├── services/
│   ├── analysisJobService.ts  # enqueue, status, persist result
│   ├── frameExtractorService.ts
│   ├── claudeVisionService.ts # multi-image Claude API calls
│   ├── claudeTextService.ts   # workout generation prompt
│   └── progressService.ts
├── workers/
│   └── analysisWorker.ts     # BullMQ worker — runs pose pipeline + Claude call
├── queues/
│   └── analysisQueue.ts      # BullMQ queue definition + job types
└── config/
    └── env.ts                # add ANTHROPIC_API_KEY, REDIS_URL

apps/native/src/
├── hooks/
│   ├── usePoseEstimation.ts  # TFLite MoveNet — returns keypoints per frame
│   ├── useFormAnalysis.ts    # angles + rule engine on top of keypoints
│   └── useJobStatus.ts       # SSE listener via react-native-sse
├── components/
│   ├── PoseSkeleton.tsx      # overlay 17 keypoints on camera feed
│   ├── RepCounter.tsx
│   └── FormCueBanner.tsx     # real-time feedback text
└── screens/
    ├── RecordingScreen.tsx   # camera + real-time analysis UI
    └── FeedbackScreen.tsx    # post-set analysis results

packages/common/src/validations/
├── analysisJob.ts            # shared Zod schemas for job payload + result
└── workout.ts                # workout creation schemas

packages/database/prisma/models/
├── AnalysisJob.prisma        # id, userId, exerciseCode, status, videoPath, ...
├── FormFeedback.prisma       # jobId, frameTimestamps, score, issues, suggestions
├── Workout.prisma            # id, userId, name, isAiGenerated, exercises[]
└── ProgressSnapshot.prisma  # userId, exerciseCode, score, createdAt
```

### Structure Rationale

- **workers/**: Isolated from routes/services so the worker can eventually run as a separate process without refactoring
- **queues/**: Single place to define queue names and job type contracts; imported by both service (enqueue) and worker (consume)
- **claudeVisionService / claudeTextService**: Two Claude surfaces with different input shapes (images vs. text-only) — keeping them separate prevents the services from growing unwieldy
- **hooks/ in native**: All pose and form logic lives in hooks, not in screen components, so the camera feed and the analysis logic are independently testable
- **packages/common validations**: Job payload schemas shared between API and native client, consistent with existing `@repo/common` pattern

---

## Architectural Patterns

### Pattern 1: On-Device Pose Estimation, Server-Side LLM Feedback

**What:** Run MoveNet Lightning directly on the device to get keypoints per frame. Send keypoints (not raw video) to the server for real-time feedback decisions, or send sampled frames (JPEG) to Claude for post-set analysis.

**When to use:** Always for the real-time path; for the post-set path when device GPU is insufficient to run heavier analysis locally.

**Trade-offs:**
- Pro: Zero video upload latency for real-time cues; privacy-preserving option (keypoints only, no video); reduces server compute for the hot path
- Pro: MoveNet Lightning runs at 50+ FPS on modern phones — well within budget
- Con: On-device model adds ~10-15 MB to the app bundle; requires `expo-gl` and `@tensorflow/tfjs-react-native`
- Con: TFLite + TFJS React Native adapter has version coupling with Expo SDK — verify compatibility at integration time

**Example keypoint structure:**
```typescript
// Output of usePoseEstimation hook
type Keypoint = { x: number; y: number; score: number; name: string }
// 17 named keypoints: nose, left_eye, right_eye, left_ear, right_ear,
// left_shoulder, right_shoulder, left_elbow, right_elbow, left_wrist,
// right_wrist, left_hip, right_hip, left_knee, right_knee, left_ankle, right_ankle
```

### Pattern 2: Upload-Once, Async Processing with BullMQ

**What:** The mobile client POSTs the video file immediately after the set ends. The API saves it, returns a job ID, and enqueues a BullMQ job. The worker processes the video asynchronously and publishes the result. The client subscribes to an SSE endpoint to receive progress and the final feedback object.

**When to use:** Post-set analysis — the operation takes 10-30 seconds (frame extraction + Claude API latency); cannot block an HTTP request.

**Trade-offs:**
- Pro: HTTP request returns instantly with job ID; no timeout risk; natural retry/failure handling via BullMQ
- Pro: Worker can be horizontally scaled independently of the API
- Con: Adds Redis as a new infrastructure dependency; adds complexity vs. synchronous processing
- Con: SSE connections require that the mobile client stays in the foreground — must handle reconnect gracefully

**Example job contract:**
```typescript
// queues/analysisQueue.ts
interface AnalysisJobPayload {
  jobId: string          // DB record UUID
  userId: string
  exerciseCode: string   // e.g. 'PUSH_UP'
  videoPath: string      // local filesystem path (temp storage)
  repCount: number       // from rep counter during recording
}
```

### Pattern 3: Frame Sampling + Multi-Image Claude Call

**What:** Rather than sending video to Claude (not supported), extract 8-12 representative JPEG frames at key moments in the movement (bottom position, top position, mid-movement) and send them as a multi-image message alongside structured context (exercise name, joint angles from on-device keypoints, rep count).

**When to use:** Post-set analysis; the only viable approach given Claude's lack of native video input support as of March 2026.

**Trade-offs:**
- Pro: Claude supports up to 600 images per request; 8-12 frames are trivially within bounds and cost-effective
- Pro: Augmenting frames with pre-computed keypoint data (angles, velocity) dramatically improves feedback quality — the model spends less effort on geometry and more on coaching
- Con: Frame selection matters; a bad sampling strategy misses the error moments (e.g., lower-back rounding at rep 6)
- Con: 8-12 frames at ~1MB each = 8-12MB per request payload — use the Files API to avoid re-uploading the same reference frames across multiple analyses

**Recommended frame selection strategy:**
```
1. Uniform sample: 1 frame per second of movement
2. Apex detection: frames at top and bottom of rep arc (via y-velocity of hip keypoint crossing zero)
3. Anomaly frames: frames where joint angle deviation exceeds threshold
Max: 12 frames. Resize to 640x480 before upload.
```

### Pattern 4: Rule Engine First, LLM Second (Real-Time Path)

**What:** For real-time feedback, run a deterministic rule engine on keypoints (e.g., "elbow angle < 90 degrees at bottom of push-up for > 2 seconds") to produce immediate cues. Call Claude only when the rule engine flags a sustained, non-trivial deviation that warrants a coaching explanation.

**When to use:** Real-time cue generation during a set.

**Trade-offs:**
- Pro: Instant (<16ms) deterministic cues with no API latency; works offline
- Pro: Claude API calls stay below ~1/minute per user, making cost manageable
- Con: Rule engine requires exercise-specific configuration per movement; push-up rules differ from pull-up rules
- Con: Rules need calibration — too sensitive means cue spam; too lenient misses errors

---

## Data Flow

### Post-Set Analysis Flow

```
User ends set
    ↓
[RecordingScreen] stops expo-camera recording → video file URI
    ↓
[uploadClient] compresses video (720p, 30fps max) → POST /api/analysis-jobs
    ↓
[AnalysisJobController] validates payload, calls analysisJobService.create()
    ↓
[analysisJobService] writes video to /tmp/uploads/, creates DB AnalysisJob (status: QUEUED)
    → responds 202 { jobId }
    ↓
[analysisJobService] enqueues BullMQ job { jobId, videoPath, exerciseCode, ... }
    ↓
[native Upload Client] opens SSE to GET /api/analysis-jobs/:jobId/stream
    ↓
[analysisWorker] picks up job:
    1. Extracts 8-12 JPEG frames (ffmpeg / fluent-ffmpeg)
    2. Calls claudeVisionService.analyzeFrames(frames, exerciseCode, repCount)
       → builds multi-image message with structured prompt
       → Claude API returns: { overallScore, issues[], suggestions[], highlights[] }
    3. Persists FormFeedback record in PostgreSQL
    4. Updates AnalysisJob status → COMPLETE
    5. Publishes SSE event: { type: 'complete', jobId, feedback }
    ↓
[native useJobStatus hook] receives SSE event → navigates to FeedbackScreen
    ↓
[FeedbackScreen] renders score + coaching text
```

### Real-Time Analysis Flow

```
User starts set → [RecordingScreen] starts camera
    ↓ per frame (30fps)
[usePoseEstimation hook] runs MoveNet Lightning on raw frame → 17 keypoints
    ↓
[useFormAnalysis hook] calculates joint angles, detects rep phase
    → rule engine checks thresholds per exercise
    → if deviation sustained > 2s: emit cue event
    ↓
[FormCueBanner] renders cue text overlay on camera feed
    ↓ (optional, throttled to max 1 call / 30s)
[claudeTextService] sends keypoint summary → Claude text API
    → richer coaching explanation if needed
    ↓
[FormCueBanner] updates with detailed explanation
```

### AI Workout Generation Flow

```
User describes goal (text input)
    ↓
POST /api/workouts/generate { goal, fitnessLevel, availableEquipment, exerciseCodes[] }
    ↓
[workoutController] → [claudeTextService.generateWorkout()]
    → structured prompt with exercise catalog context
    → Claude returns: { name, exercises[{ code, sets, reps, rest }] }
    ↓
[workoutService.save()] persists Workout + WorkoutExercise records
    → responds 201 { workout }
    ↓
[native] navigates to WorkoutDetailScreen
```

### State Management (Mobile)

```
[Global Auth Context] — JWT token, user UUID
    ↓
[WorkoutSessionContext] — active session state during recording
    ├── current exercise, current set number
    ├── rep count (from useFormAnalysis)
    └── pending job IDs awaiting SSE results

[useJobStatus hook] — per-job SSE subscription
    → dispatches to local component state on FeedbackScreen
```

---

## Build Order (Dependencies Drive Sequence)

The pipeline has hard dependencies that determine build order:

**Phase 1 — Infrastructure before features:**
Redis + BullMQ setup, multer video upload endpoint, AnalysisJob DB model, SSE endpoint scaffolding. Nothing else in the AI pipeline works without these.

**Phase 2 — Post-set analysis before real-time:**
Post-set analysis (upload → frames → Claude) is simpler — no on-device ML, no frame processor. Build and validate the full Claude feedback loop first. Real-time analysis depends on validating that the keypoint + angle approach produces coherent feedback.

**Phase 3 — Pose estimation after feedback is proven:**
Integrate TFLite MoveNet on-device only after the server-side feedback format is locked. The on-device rule engine keys off the same angle thresholds validated during post-set analysis.

**Phase 4 — AI workout generation is independent:**
No dependency on the video pipeline. Can be built in parallel with Phase 1-2 if resourcing allows, or deferred to its own phase.

**Phase 5 — Progress tracking is downstream of everything:**
Progress scores come from FormFeedback records; ProgressSnapshot writes happen inside the analysis worker after feedback is persisted. Build after Phase 2 is stable.

```
Phase 1: Upload infrastructure (Redis, BullMQ, file upload, SSE, DB models)
    ↓
Phase 2: Post-set AI analysis (frame extraction → Claude vision → feedback UI)
    ↓
Phase 3: Real-time analysis (on-device MoveNet → rule engine → live cues)

Phase 4: AI workout generation (independent — Claude text API)

Phase 5: Progress tracking (depends on Phase 2 feedback data existing)
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Monolith fine — BullMQ worker runs in same Node.js process; video stored on local filesystem; Redis single instance |
| 1k-10k users | Move videos to object storage (S3 or R2) — local disk won't survive multi-instance deploy; add Redis Sentinel or managed Redis; extract worker to separate Dockerfile |
| 10k+ users | Worker autoscaling (separate service with multiple BullMQ consumers); CDN for video delivery if storing user recordings long-term; rate-limit Claude API calls per user |

### Scaling Priorities

1. **First bottleneck — video disk I/O:** The API receives large multipart uploads and workers read them for frame extraction. Local disk becomes a concurrency bottleneck quickly. Move to S3-compatible storage before scaling to multiple API instances.
2. **Second bottleneck — Claude API rate limits:** Anthropic has per-minute token limits. A surge of simultaneous post-set analyses will hit rate limits before hitting server capacity. Add exponential backoff and a per-user daily analysis limit early.

---

## Anti-Patterns

### Anti-Pattern 1: Sending Raw Video to Claude

**What people do:** Try to upload the entire video file directly to Claude expecting video understanding.

**Why it's wrong:** Claude does not support video input as of March 2026. The API accepts images (JPEG, PNG, GIF, WebP) only. Attempts to send video will fail or require the entire video to be decoded into frames client-side, bloating the payload massively.

**Do this instead:** Extract 8-12 JPEG frames server-side using ffmpeg after upload. Send frames as a multi-image Claude message. Augment with structured keypoint data (angles) to compensate for the lost temporal context.

### Anti-Pattern 2: Synchronous Claude API Call in HTTP Request Handler

**What people do:** Call Claude directly inside the Express route handler and await the response before returning to the client.

**Why it's wrong:** Claude API calls for vision analysis take 5-30 seconds. This holds the HTTP connection open, exhausts connection pool slots, and times out on mobile networks.

**Do this instead:** Return a job ID immediately (202 Accepted). Process asynchronously in a BullMQ worker. Push results to the client via SSE.

### Anti-Pattern 3: Running Pose Estimation in the React Native JS Thread

**What people do:** Import TFLite model and run inference inside a `useEffect` or frame callback that executes on the JS thread.

**Why it's wrong:** The JS thread is single-threaded. Running ML inference on it at 30fps blocks the UI thread, causing dropped frames and unresponsive UI.

**Do this instead:** Use `react-native-vision-camera` frame processors which run on a dedicated JS Runtime thread (VisionCamera worklets), or run TFLite inference via the TFJS React Native adapter which uses WebGL/GPU acceleration via `expo-gl`.

### Anti-Pattern 4: Storing Videos Permanently by Default

**What people do:** Persist all user recordings to the server as a feature ("see your past recordings").

**Why it's wrong:** Video storage costs are non-trivial and this is explicitly out of scope for v1. It also creates GDPR/data retention obligations.

**Do this instead:** Treat uploaded videos as ephemeral processing inputs. Delete from server storage after the analysis worker completes (successful or failed). The feedback artifact (text, scores, keypoint snapshots) is what persists, not the video.

### Anti-Pattern 5: One Monolithic Claude Prompt for All Exercises

**What people do:** Write a single generic prompt: "Analyze this exercise form."

**Why it's wrong:** Different exercises have fundamentally different error modes. A push-up prompt needs to check elbow flare, spinal alignment, and full range of motion. A pull-up prompt needs to check chin-over-bar, scapular depression, and kipping. A generic prompt produces vague, unhelpful feedback.

**Do this instead:** Maintain a prompt template per exercise code. The `claudeVisionService` selects the template based on `exerciseCode` (already in the existing exercise catalog). Start with the four core exercises: `PUSH_UP`, `PULL_UP`, `DIP`, `SQUAT`.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude API (Anthropic) | REST HTTP via `@anthropic-ai/sdk` inside analysis worker | Add `ANTHROPIC_API_KEY` to env; use `claude-sonnet-4-5` or current Sonnet for vision; 5MB per image limit, 32MB request limit |
| Redis | BullMQ backing store; `REDIS_URL` env var | Required for BullMQ. Can use managed Redis (Upstash, Redis Cloud) in production. Not needed for workout generation or progress — only for the analysis job queue |
| ffmpeg / fluent-ffmpeg | Child process or native binding in API worker | Used for frame extraction. Requires `ffmpeg` binary present on server. Alternative: use `canvas` + video decode in Node.js (heavier, slower) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| native ↔ API (video upload) | Multipart POST over HTTPS | `FormData` with video file URI from expo-camera; standard `multer` on Express side |
| native ↔ API (job status) | SSE stream (`text/event-stream`) | `react-native-sse` on client; `res.write()` loop on Express side tied to BullMQ job events |
| native ↔ on-device ML | In-process via TFLite | No network; TFJS React Native adapter, `expo-gl` for GPU; keypoints stay on device |
| API route ↔ Analysis Worker | BullMQ job queue via Redis | Service enqueues; worker consumes. Decouple timing entirely. |
| Analysis Worker ↔ Claude API | HTTPS REST (`@anthropic-ai/sdk`) | Runs inside worker process; retry logic via BullMQ job retry settings |
| Worker ↔ SSE Endpoint | In-process event emission or Redis pub/sub | Simple case: both run in same Node.js process, use Node EventEmitter. Multi-instance case: use Redis pub/sub to fanout SSE events |
| All API layers ↔ DB | `@repo/db` (getPrismaClient) | Existing pattern — no direct Prisma imports outside `packages/database` |
| API ↔ @repo/common | Zod schema import | Add new schemas for `AnalysisJob`, `FormFeedback`, `WorkoutPlan` to `packages/common` |

---

## Confidence Notes

- **Pose estimation library selection (MEDIUM):** TFLite MoveNet via TFJS React Native is documented with official examples, but Expo SDK 54 specific compatibility is unverified. The VisionCamera + MLKit path (`react-native-vision-camera-mlkit`) is an alternative that may have better Expo SDK 54 support — validate this early in Phase 3.
- **BullMQ + Redis for async jobs (HIGH):** Well-established Node.js pattern, official docs, multiple production examples.
- **Claude vision via frame sampling (HIGH):** Officially documented. Multi-image support confirmed up to 600 images/request. 5MB per image, 32MB total request limit documented.
- **SSE for job progress in React Native (MEDIUM):** `react-native-sse` is actively maintained (npm package exists, used in production). Standard EventSource API. Minor risk: reconnect handling on mobile network switches.

---

## Sources

- Claude Vision API docs (official): https://platform.claude.com/docs/en/build-with-claude/vision
- TFLite MoveNet in React Native (TF official): https://www.tensorflow.org/js/tutorials/applications/react_native
- TF examples pose detection app: https://github.com/tensorflow/tfjs-examples/blob/master/react-native/pose-detection/App.tsx
- VisionCamera MLKit frame processor: https://github.com/pedrol2b/react-native-vision-camera-mlkit
- BullMQ official site: https://bullmq.io/
- react-native-sse package: https://www.npmjs.com/package/react-native-sse
- AI workout form corrector with RN + TFLite: https://www.wellally.tech/blog/build-ai-workout-form-corrector-react-native-tensorflow
- MediaPipe BlazePose on-device overview: https://research.google/blog/on-device-real-time-body-pose-tracking-with-mediapipe-blazepose/
- Expo video upload reliability: https://expo.dev/blog/faster-more-reliable-video-uploads-with-expo-modules
- VisionCamera vs expo-camera 2026 comparison: https://www.pkgpulse.com/blog/react-native-vision-camera-vs-expo-camera-vs-expo-image-picker-2026

---

*Architecture research for: AI calisthenics form analysis pipeline*
*Researched: 2026-03-21*
