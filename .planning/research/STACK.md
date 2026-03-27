# Technology Stack — AI Form Analysis & Workout Generation

**Project:** Cali AI (subsequent milestone)
**Researched:** 2026-03-21
**Dimension:** Stack additions for AI video form analysis + AI-generated workout plans
**Confidence:** MEDIUM-HIGH overall (core AI APIs are HIGH; pose estimation tooling is MEDIUM due to rapid ecosystem churn)

---

## Context: What Already Exists

The monorepo ships: Turborepo, Express 5.1.0 API, React Native / Expo SDK 54 (managed workflow), PostgreSQL + Prisma 7, JWT auth, Zod validation, `@repo/db` / `@repo/common` / `@repo/ui` shared packages. The additions below must slot into that baseline without requiring a workflow change on the native side unless explicitly noted.

---

## Recommended Stack Additions

### Mobile — Camera & Video Capture

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-native-vision-camera` | ^4.x | Real-time frame capture for live pose overlay + post-set video recording | expo-camera cannot expose raw frames to JS or native modules — no frame processors, no real-time ML. VisionCamera runs frame processors on a dedicated C++ thread at 2–5 ms per frame, consistent 30–60 FPS. This is the only viable path for real-time analysis without dropping to a full bare workflow. |
| `expo-video` | ~2.x (SDK 54 bundled) | Video playback of recorded sets in review UI | Ships with Expo SDK 54 managed workflow; no extra config needed. |

**Why not `expo-camera` for real-time analysis:** expo-camera is adequate for static photo/video recording only. It offers no frame processor API, so TFLite or MediaPipe cannot receive live frames. Confirmed by official Expo Camera docs and community benchmarks.
Confidence: HIGH (verified against official docs and multiple technical sources)

---

### Mobile — Pose Estimation (Real-Time)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-native-fast-tflite` | ^1.2.0 | On-device TensorFlow Lite inference via VisionCamera frame processor | Authored by VisionCamera's creator (mrousavy), ships a VisionCamera-native frame processor plugin, supports Expo config plugin for managed workflow, CoreML delegate on iOS, GPU/NNAPI delegate on Android. |
| MoveNet SinglePose Lightning (`.tflite`) | TF Hub model | 17 body-keypoint detection | Fastest available pose model: 33 ms on mid-range Android vs. ~80 ms for Thunder. Sufficient for calisthenics — all target exercises (push-ups, pull-ups, dips, squats) involve clearly separated landmarks. |
| `@shopify/react-native-skia` | ^1.x | Skeleton wireframe overlay on live camera feed | GPU-accelerated 2D drawing API; integrates directly with VisionCamera frame processors; community-standard for pose overlays in RN. |

**Why not `@tensorflow/tfjs-react-native`:** Documented dependency conflicts with Expo SDK 50+. Requires `expo-gl` / `expo-gl-cpp`, which introduces native module complexity. Multiple open GitHub issues for SDK 51 and later confirm installation breakage. The `react-native-fast-tflite` + VisionCamera path avoids the GL dependency entirely and is measurably faster.
Confidence: MEDIUM (fast-tflite + VisionCamera architecture is well-documented; exact SDK 54 peer-dep resolution needs validation at implementation time)

**Why not MediaPipe React Native wrappers (`@gymbrosinc/react-native-mediapipe-pose`, `@thinksys/react-native-mediapipe`):** All available wrappers are thin community bridges with small maintenance teams, inconsistent Expo support, and no clear path to Expo managed workflow config plugins. MoveNet via react-native-fast-tflite delivers equivalent landmark quality with a much more stable integration surface.
Confidence: MEDIUM (based on npm publish dates and GitHub activity; ecosystem could change)

---

### Mobile — Video Upload

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `expo-file-system` | ~18.x (SDK 54 bundled) | Read recorded video URI, construct upload payload | Already available in the Expo SDK; no addition needed. `react-native-fs` is not available in managed Expo — do not use it. |
| Direct-to-S3 presigned URL (PUT) | n/a | Upload video bytes from device directly to S3 | Removes API server from the upload path entirely, avoiding memory pressure on the Express process for large video files. The API generates a short-lived presigned URL; the device PUTs directly to S3. |
| S3 multipart upload for segments >5 MB | via `@aws-sdk/client-s3` on the API side | Reliable upload for longer sets | Presigned multipart allows chunked parallel upload; S3 reassembles. Required for videos longer than ~10 seconds at 720p. |

Confidence: HIGH (well-established pattern; Expo file system docs confirm expo-file-system is the correct package)

---

### Backend — Video Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| AWS S3 (or compatible, e.g., Cloudflare R2) | — | Durable object storage for uploaded exercise videos | PROJECT.md explicitly defers a full video CDN; S3 is the minimum viable durable store. R2 is a viable zero-egress-cost alternative. |
| `@aws-sdk/client-s3` | ^3.x | Presigned URL generation, object lifecycle on the Express API | AWS SDK v3 is tree-shakeable and ESM-compatible; do not use v2. |
| `@aws-sdk/s3-request-presigner` | ^3.x | Generates `PutObject` presigned URLs | Companion to client-s3; required for the direct-upload pattern. |

Confidence: HIGH (AWS SDK v3 is the current official SDK; well-documented)

---

### Backend — Async Video Analysis Pipeline

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `bullmq` | ^5.x | Job queue for post-set video analysis jobs | Video analysis via a vision API is not synchronous — it can take 3–15 seconds. BullMQ on Redis queues the job immediately, returns a job ID to the client, and a worker picks it up. Built on Redis (same Redis used by many Express deployments); TypeScript-native; active maintenance since 2021. |
| `ioredis` | ^5.x | Redis client for BullMQ within the Express monorepo | BullMQ's recommended Redis client; types included. |
| Server-Sent Events (SSE) on the Express API | built-in | Push analysis results back to the native client | Simpler than WebSockets for one-way result delivery; no extra library needed; works with Express 5; client uses the native `EventSource` API via a polyfill. |

**Why not polling:** Polling for analysis results creates unnecessary API load and introduces latency. SSE is the right primitive for "here is your result when it's ready."
**Why not WebSockets:** The result delivery is one-directional (server → client) and not interactive. WebSockets add complexity without benefit here.
Confidence: HIGH (BullMQ is well-established; SSE is HTTP-native)

---

### Backend — Form Feedback AI (Post-Set)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | current | Translate extracted keyframe pose data + joint angles into human-readable form feedback | Project constraint specifies Claude API. Haiku 4.5 is the fastest Claude model (lowest latency, lowest cost at $1/$5 per MTok), supports vision, and supports structured outputs. For post-set feedback where the primary input is angle/rep data (not raw video), Haiku 4.5 is sufficient and economical. Use Sonnet 4.6 for edge cases needing richer reasoning. |
| `@anthropic-ai/sdk` | ^0.x (latest) | TypeScript SDK for Claude API calls | Official Anthropic SDK; types included; supports streaming and tool use. |
| Claude structured outputs (`anthropic-beta: structured-outputs-2025-11-13`) | beta (Nov 2025) | Return form feedback as typed JSON (score, issues[], suggestions[]) | Anthropic's structured outputs guarantee JSON schema compliance at the token level — eliminates validation/retry logic. Supports Zod schema input in TypeScript. Currently in public beta for Haiku 4.5 and Sonnet 4.5+. |

**Form analysis architecture — recommended approach:**
1. On-device MoveNet extracts 17 keypoints per frame.
2. The app computes joint angles (e.g., elbow angle, hip angle) client-side at ~30 FPS.
3. On rep completion, the client sends the **angle time-series** for the rep (not raw video frames) to the API.
4. The API worker passes the angle summary + exercise name to Claude Haiku 4.5 with a form-analysis prompt.
5. Claude returns structured JSON: `{ score: number, issues: string[], positives: string[], cues: string[] }`.

This architecture avoids sending video to the AI API entirely for the real-time path, which reduces cost and latency by ~10x compared to frame-based VLM analysis.

**Why not GPT-4o vision for form analysis:** GPT-4o vision is strong but the project constraint specifies Claude. Claude Haiku 4.5 is faster and cheaper than GPT-4o-mini for text-in/text-out tasks. If frame-level visual analysis is needed (e.g., the user's phone cannot run MoveNet), Claude Sonnet 4.6 vision handles multi-image input up to 600 frames per request.
Confidence: HIGH (verified against official Anthropic models page and structured-outputs announcement, March 2026)

---

### Backend — Real-Time Form Cues (Live Path)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| On-device inference only (no API call in the hot path) | — | Sub-100 ms latency requirement for live cues | Any API round-trip at mobile network latency (30–200 ms) + model inference (200–2000 ms) exceeds the tolerable latency window for real-time cues. Live form cues must be derived purely from on-device MoveNet output. |
| Claude Haiku 4.5 (triggered only on sustained deviation) | — | Convert a detected deviation into a coaching cue string | Throttled: invoked at most once per 3 seconds when a form error persists for 2+ seconds. Returns a single short cue string, not a full analysis. This is the pattern documented in production fitness apps using Claude for real-time coaching. |

Confidence: HIGH (throttling pattern verified via real-world implementation reference)

---

### Backend — Workout Generation AI

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Claude Sonnet 4.6 (`claude-sonnet-4-6`) | current | Generate workout plans from user goals | Sonnet 4.6 is the current best speed/intelligence tradeoff at $3/$15 per MTok. Workout generation is a reasoning task (select exercises, set appropriate volume, sequence for goals) that benefits from Sonnet's stronger reasoning over Haiku. 1M token context window covers extensive session history. |
| Claude structured outputs | same beta header | Return workout as typed JSON matching the existing exercise catalog schema | Same pattern as form feedback; ensures the returned exercise codes match the seeded catalog; eliminates hallucinated exercise names. |

**Workout generation architecture:**
1. User submits: goal description, available equipment, experience level, session history summary.
2. API injects the current exercise catalog (codes + descriptions) as context.
3. Claude Sonnet 4.6 returns `{ name: string, exercises: [{ code: string, sets: number, reps: number | string, rest: number }][] }`.
4. API validates all `code` values against the exercise catalog before persisting.

Confidence: HIGH (Claude structured outputs confirmed for Sonnet 4.5+; pattern is straightforward)

---

### Supporting Libraries (New)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@aws-sdk/client-s3` | ^3.x | Presigned URL generation | Video upload API endpoint |
| `@aws-sdk/s3-request-presigner` | ^3.x | Presigned PUT URL | Companion to client-s3 |
| `bullmq` | ^5.x | Job queue | Post-set analysis worker |
| `ioredis` | ^5.x | Redis client | BullMQ backing store |
| `@anthropic-ai/sdk` | latest | Claude API calls | Form feedback + workout generation |
| `react-native-vision-camera` | ^4.x | Real-time camera frames | Live pose analysis screen |
| `react-native-fast-tflite` | ^1.2.0 | On-device TFLite inference | Pose keypoint extraction |
| `@shopify/react-native-skia` | ^1.x | GPU 2D drawing | Skeleton overlay on camera |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Camera (real-time) | react-native-vision-camera v4 | expo-camera | expo-camera has no frame processor API; cannot access raw frames for ML inference |
| Pose estimation (mobile) | react-native-fast-tflite + MoveNet | @tensorflow/tfjs-react-native | tfjs-react-native has documented SDK 50+ compatibility breaks; heavier GL dependency; slower inference path |
| Pose estimation (mobile) | react-native-fast-tflite + MoveNet | MediaPipe RN wrappers | All wrappers are community-maintained with small teams; no Expo managed workflow config plugin; inconsistent iOS/Android parity |
| Form analysis (AI) | On-device angles → Claude Haiku 4.5 | Direct video frame → VLM | 10x lower cost and latency; VLM frame analysis is only needed if on-device pose extraction fails |
| Workout generation | Claude Sonnet 4.6 | OpenAI GPT-4o | Project constraint specifies Claude; Sonnet 4.6 matches GPT-4o on reasoning tasks at same price tier |
| Job queue | BullMQ + Redis | In-process async (setImmediate) | No persistence; analysis jobs lost on Express restart; no retry logic |
| Job queue | BullMQ + Redis | Temporal / custom worker | BullMQ is leaner, TypeScript-native, and sufficient for a single-service video pipeline |
| Video result delivery | SSE | WebSockets | Analysis result is one-directional; WebSockets add handshake overhead without benefit |

---

## Key Architecture Decision: On-Device Angles vs. Frame Upload

The two viable paths for form analysis are:

**Path A (Recommended): On-device pose → angle time-series → Claude text API**
- MoveNet on device, 30 FPS, zero network cost for inference
- Client computes joint angles, sends ~1 KB angle summary per rep to API
- Claude Haiku 4.5 reads the angle data and produces feedback
- Cost: ~$0.001–0.003 per analysis (text tokens only)
- Latency: API round-trip only (~500 ms for post-set; throttled for real-time)

**Path B (Fallback): Upload video → extract frames server-side → Claude vision API**
- Required if device cannot run MoveNet (low-end hardware)
- Extract 4–8 key frames from uploaded video, send to Claude vision
- Claude Sonnet 4.6 accepts up to 600 images per request at ~1,600 tokens/image
- Cost: ~$0.05–0.20 per analysis (image tokens dominate)
- Latency: S3 upload + frame extraction + API call (~5–15 seconds)

Ship Path A. Build Path B as a fallback for the post-set flow only. Do not use Path B for real-time.

---

## Installation

```bash
# Native app (apps/native)
yarn add react-native-vision-camera react-native-fast-tflite @shopify/react-native-skia

# API (apps/api)
yarn add @anthropic-ai/sdk @aws-sdk/client-s3 @aws-sdk/s3-request-presigner bullmq ioredis
```

**Expo config plugin additions required in `apps/native/app.json`:**
```json
{
  "expo": {
    "plugins": [
      ["react-native-vision-camera", { "cameraPermissionText": "Allow Cali AI to use your camera for form analysis." }],
      ["react-native-fast-tflite", { "enableCoreMLDelegate": true }]
    ]
  }
}
```

Note: `react-native-vision-camera` and `react-native-fast-tflite` both require a custom development build (`expo prebuild` + EAS Build or local native build). They are not compatible with Expo Go. This is the primary workflow change this milestone introduces.

---

## Open Questions / Risks

1. **Expo managed workflow vs. development build:** VisionCamera and fast-tflite require a custom dev build. Confirm the team can run EAS Build or has a local Xcode/Android Studio environment before committing to this path. If neither is available, fall back to post-set-only analysis using `expo-camera` for recording + Path B (frame upload).

2. **MoveNet accuracy on calisthenics:** MoveNet SinglePose Lightning was validated on general human pose datasets. Calisthenics positions (e.g., full pull-up lockout, L-sit) may produce landmark dropout on edge-case body positions. Validate during spike before committing to the full angle-detection pipeline.

3. **BullMQ / Redis dependency:** Adds a Redis instance to the infrastructure. Use Upstash (serverless Redis) for lowest operational overhead in early stages.

4. **Structured outputs beta header:** `anthropic-beta: structured-outputs-2025-11-13` is a public beta header as of November 2025. Confirm it remains active before GA launch; check the Anthropic deprecation/changelog page.

---

## Sources

- Anthropic Models Overview (verified March 2026): https://platform.claude.com/docs/en/about-claude/models/overview
- Anthropic Vision API documentation (verified March 2026): https://platform.claude.com/docs/en/build-with-claude/vision
- Anthropic Structured Outputs announcement (November 2025): https://techbytes.app/posts/claude-structured-outputs-json-schema-api/
- react-native-fast-tflite GitHub: https://github.com/mrousavy/react-native-fast-tflite
- react-native-vision-camera frame processor docs: https://react-native-vision-camera.com/docs/guides/frame-processor-plugins-community
- TensorFlow MoveNet README: https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/movenet/README.md
- Real-world fitness app using Claude + pose estimation (Dev.to, 2025): https://dev.to/godlymane11/how-i-built-real-time-ai-form-correction-into-a-mobile-fitness-app-3k09
- Expo camera vs. VisionCamera comparison (2025/2026): https://blog.patrickskinner.tech/react-native-camera-expo-vs-visioncamera-what-you-need-to-know
- BullMQ documentation: https://docs.bullmq.io
- AWS SDK v3 S3 presigned URL: https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
- tfjs-react-native Expo SDK 51 compatibility issues: https://github.com/expo/expo/issues/30060
- Faster uploads with Expo Modules (STRV, Dec 2025): https://medium.com/@strv/faster-more-reliable-uploads-with-expo-modules-d26b89118ef9
