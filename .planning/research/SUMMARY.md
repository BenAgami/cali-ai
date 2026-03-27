# Research Summary — Cali AI

**Project:** Cali AI
**Synthesized:** 2026-03-21
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall Confidence:** MEDIUM-HIGH

---

## Executive Summary

Cali AI is a calisthenics mobile app with two distinct AI surfaces: post-set video form analysis (upload → frame extraction → Claude vision) and AI-generated workout plans (Claude text). The research establishes a clear two-track pipeline. On the mobile side, real-time on-device pose estimation via `react-native-vision-camera` + `react-native-fast-tflite` + MoveNet Lightning is the correct technical path — but it requires a custom Expo development build, which is the single hardest blocker to resolve before any ML code is written. On the backend, every video analysis must go through an async job queue (BullMQ + Redis) because Claude API calls take 5–30 seconds and cannot block HTTP connections. These two facts — the dev build requirement and the async queue requirement — are non-negotiable infrastructure gates that everything else depends on.

The recommended build sequence is strictly ordered by dependency: infrastructure first (Redis, BullMQ, upload endpoint, SSE, DB state machine), then post-set analysis (frame extraction + Claude vision + feedback UI), then real-time on-device inference, with AI workout generation running independently in parallel as it has no dependency on the video pipeline. This ordering exists because real-time analysis is the harder version of the same problem as post-set analysis — you cannot safely commit to the angle-detection approach for live cues until post-set analysis proves the pose data produces coherent Claude feedback. Skipping post-set validation to go directly to real-time is the single most dangerous sequencing mistake in this project.

The competitive opportunity is clear: no existing competitor combines LLM workout generation, post-set AI form analysis, and real-time form cues in a calisthenics-focused package. Freeletics owns generation, Gymscore owns post-hoc scoring, ChAIron owns real-time. Cali AI can own all three for the calisthenics vertical if the AI quality is trustworthy. Quality is the operative word — deep, accurate analysis on four exercises (push-ups, pull-ups, dips, squats) beats shallow coverage of hundreds. The primary retention risk is not technical but behavioral: AI that only finds fault drives churn within three sessions. Building the positive feedback path is not a polish task — it is a day-one product requirement.

---

## Key Findings

### From STACK.md

| Technology | Role | Rationale |
|------------|------|-----------|
| `react-native-vision-camera` v4 | Real-time camera frames | Only viable path for frame processors in Expo; `expo-camera` has no raw frame API |
| `react-native-fast-tflite` v1.2 | On-device TFLite inference | VisionCamera-native frame processor plugin; CoreML/GPU delegates; Expo config plugin |
| MoveNet SinglePose Lightning | Pose keypoints | 33 ms on mid-range Android; sufficient for all four target exercises |
| `@shopify/react-native-skia` | Skeleton overlay | GPU-accelerated; integrates directly with VisionCamera frame processors |
| `bullmq` v5 + `ioredis` v5 | Async job queue | Post-set analysis takes 5–30s; no synchronous path is viable; Redis backing store |
| Server-Sent Events (SSE) | Result delivery | One-directional server→client push; no WebSocket overhead needed |
| Claude Haiku 4.5 | Form feedback text | Fastest/cheapest Claude model; sufficient for angle-to-text conversion; structured outputs |
| Claude Sonnet 4.6 | Workout generation | Stronger reasoning for multi-exercise programming decisions; 1M context covers session history |
| Anthropic structured outputs | JSON schema enforcement | Eliminates validation retry logic; guarantees exercise codes match catalog |
| AWS S3 / Cloudflare R2 | Video object storage | Presigned PUT pattern removes API server from upload path; multipart for >5 MB |

**Critical version note:** `react-native-vision-camera` and `react-native-fast-tflite` are incompatible with Expo Go. They require a custom development build (`expo prebuild` + EAS Build or local native build). This is the primary workflow change the milestone introduces and must be validated before any other ML work begins.

**Recommended analysis path:** On-device MoveNet extracts keypoints → client computes joint angles → angle time-series sent to API per rep → Claude Haiku 4.5 converts angles to feedback text. Cost is ~$0.001–0.003 per analysis vs. $0.05–0.20 for raw frame upload. The frame-upload path (Path B) is a fallback for post-set only when the device cannot run MoveNet.

---

### From FEATURES.md

**Table stakes (must ship v1):**
- Exercise library with video demos — already seeded; needs native UI
- Workout session logging — existing; needs UI wiring
- Post-set AI form analysis — core product promise; users churn immediately if absent
- Form score per set — users need a concrete number to anchor progress
- Form score trend over time — turns one-off events into a coaching relationship
- User profile (name, avatar, fitness level, goals) — required for AI workout calibration
- Manual workout builder — experienced users will not trust AI-only generation
- Named, saveable workouts — core habit loop (repeat "my Monday push workout")
- Push notification reminders — standard retention mechanic

**Differentiators (competitive advantage):**
- Real-time form cues during a set — no competitor combines this with LLM generation in calisthenics vertical; hardest feature; validate post-set first
- AI-generated workout from goal description — more flexible than Freeletics template system
- Per-exercise form score trend charts — unique to AI-analysis apps; directly reinforces core value
- Rep-level, actionable feedback text — "in rep 4, your hips dropped" vs. generic cues
- Explainable form scores — breakdown by ROM, stability, symmetry gives users something to act on

**Anti-features (explicitly defer):**
- Social feed — separate product with content moderation complexity; use native share sheets instead
- Nutrition / meal planning — outside domain; doubles product surface
- Wearable integration — does not improve form analysis quality; defer to v2
- Auto-detect exercise from video — ~60–70% accuracy is not good enough; require user selection
- AI analysis on 2500+ exercises — depth on 4 beats breadth on hundreds; quality is the signal

**Feature dependencies (strict ordering enforced by research):**
```
User Profile → AI Workout Generation (calibration context)
Exercise Catalog → Manual Workout Builder → AI Workout Generation (baseline for comparison)
Workout Sessions → Post-Set AI Form Analysis → Real-Time Form Cues (same pipeline, harder version)
Post-Set Form Analysis → Progress Tracking — form scores (data must exist before charts)
```

---

### From ARCHITECTURE.md

**Five major components:**

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Pose Estimation Layer | `apps/native` hooks | MoveNet Lightning → 17 keypoints/frame; runs on-device via VisionCamera frame processor |
| Form Analysis Client | `apps/native` hooks | Joint angle calculation + rule engine; throttled Claude call on sustained deviation |
| Upload Client | `apps/native` | Compress/trim video; POST to API; SSE listener for job progress |
| Analysis Job Service + Worker | `apps/api` workers/ | BullMQ job: frame extraction → Claude vision → persist feedback → SSE event |
| AI Workout Generator | `apps/api` services/ | Claude text API; independent of video pipeline; can be parallelized |

**Key architectural patterns:**
1. **On-device angles, server-side LLM** — run MoveNet on device; send angle time-series (not video) to API; Claude interprets angles as coaching text. Zero video upload cost for real-time path.
2. **Upload-once, async BullMQ** — 202 response with job ID; worker processes; SSE delivers result. Never block HTTP handler on Claude API call.
3. **Frame sampling + multi-image Claude** — 8–12 representative JPEGs (apex positions + anomaly frames at >threshold deviation); resize to 640x480. Claude does not accept raw video input.
4. **Rule engine first, LLM second** — deterministic rules produce instant (<16 ms) cues; Claude called only on sustained deviation, throttled to max 1 call per 30 seconds per user.

**Build order (driven by hard dependencies):**
```
Phase 1: Infrastructure (Redis, BullMQ, file upload, SSE, DB state machine)
    ↓ (nothing in the AI pipeline works without this)
Phase 2: Post-set analysis (frame extraction → Claude vision → feedback UI)
    ↓ (validates keypoint + angle approach before real-time commit)
Phase 3: Real-time analysis (on-device MoveNet → rule engine → live cues)

Phase 4: AI workout generation (independent — runs parallel to Phase 1–2 if resources allow)

Phase 5: Progress tracking (downstream of Phase 2; requires FormFeedback records to exist)
```

**Session state machine (existing blocker):** `processingStatus` field on `WorkoutSession` currently never advances beyond `PENDING`. The full `PENDING → PROCESSING → COMPLETED / FAILED` machine with a 10-minute timeout cleanup job must be implemented as part of Phase 1, before any AI integration work.

---

### From PITFALLS.md

**Top 7 pitfalls with prevention strategies:**

| # | Pitfall | Severity | Prevention | Phase to Address |
|---|---------|----------|------------|------------------|
| 1 | Expo managed workflow incompatible with on-device ML libraries | CRITICAL | Validate `react-native-vision-camera` + `react-native-fast-tflite` in a custom dev build on both simulators before writing any ML code. If EAS Build is not available, fall back to post-set-only with `expo-camera` + Path B (server frame extraction). | Before Phase 1 |
| 2 | `processingStatus` stuck in PROCESSING forever | CRITICAL | Implement full 4-state machine in Phase 1 upload endpoint. Add server-side timeout cron (10 min → FAILED). Client must handle FAILED with retry UI. | Phase 1 |
| 3 | AI form feedback that is always negative destroys retention | HIGH | Lead with positives. Limit corrections to 2 per set (highest confidence only). Code path must exist that produces a purely positive response. Define feedback tone in Claude prompt before writing the prompt. | Phase 2 |
| 4 | Video upload fails silently on iOS when app is backgrounded | HIGH | Use `react-native-background-upload` (NSURLSession-based) from day one. Compress video to 480p before upload. Poll `processingStatus` on app foreground resume. | Phase 1 |
| 5 | Horizontal exercise positions break pose detection (push-ups, dips) | HIGH | Validate MoveNet accuracy specifically for push-up down-position and pull-up top-position before committing to angle-detection pipeline. Set per-exercise confidence thresholds (below 0.6 → show camera adjustment prompt, not wrong feedback). | Phase 2/3 validation |
| 6 | LLM-generated workouts prescribe unsafe progressions | HIGH | Constrain to seeded exercise catalog via structured output. System prompt must enforce progressive overload rules and rest days. Validate JSON against Zod schema server-side before persisting. Add disclaimer UI on every AI-generated plan. | Phase 4 |
| 7 | Real-time pose inference kills battery and triggers thermal throttling | MEDIUM | Cap inference at 8–10 FPS. Run frame skip strategy. Test on mid-range Android unplugged for 15 minutes before declaring real-time complete. | Phase 3 |

**Existing codebase concerns that must be fixed before AI integration:**
- `processingStatus` never advances (documented in CONCERNS.md) — fix in Phase 1
- `any` type on error handler — replace with typed `PrismaClientKnownRequestError` + `AIServiceError` before AI errors are introduced
- `BigInt` manual serialization per field — add global JSON replacer before any new BigInt fields are introduced
- CORS `origin: true` wildcard — replace with explicit allowlist before any public URL is shared

---

## Implications for Roadmap

### Recommended Phase Structure

**Phase 0 — Dev Build Spike (1–2 days, hard gate)**

Validate that `react-native-vision-camera` + `react-native-fast-tflite` installs and runs on both iOS and Android simulators under Expo SDK 54 with a custom dev build. This is a hard go/no-go gate. If it fails, the real-time analysis path is blocked and Phase 3 must be replaced with a server-side frame extraction fallback. Do not proceed to Phase 1 without resolving this.

Features: None shipped. Pure risk elimination.
Pitfalls avoided: Pitfall 1 (Expo managed workflow incompatibility).
Research flag: NEEDS VERIFICATION — this is the highest-uncertainty technical decision in the milestone.

---

**Phase 1 — Infrastructure Foundation**

Everything the AI pipeline depends on. Ship: upload endpoint with multipart handling, BullMQ + Redis job queue, SSE result stream, full `processingStatus` state machine (PENDING → PROCESSING → COMPLETED / FAILED with 10-min timeout cleanup), AnalysisJob + FormFeedback + Workout DB models, S3 presigned URL upload pattern, existing codebase fixes (error handler types, BigInt serializer).

Features delivered: Backend infrastructure only. No user-visible AI features yet.
Why first: Nothing in the AI pipeline works without async job infrastructure and a correct session state machine. Building AI features on top of a broken state machine creates unfixable UX debt.
Pitfalls avoided: Pitfall 2 (stuck processingStatus), Pitfall 4 (iOS background upload).

---

**Phase 2 — Post-Set AI Form Analysis**

The core product promise. Ship: post-set video recording (expo-camera), video upload to S3 via presigned URL, BullMQ job processing (frame extraction + Claude Haiku 4.5 vision), structured feedback response (score, issues, positives, cues), FeedbackScreen UI, form score persistence. Validate pose accuracy for all four exercises before enabling.

Features delivered: Upload video → receive form score + breakdown + feedback text. Push-ups, pull-ups, dips, squats.
Why second: Validates the entire Claude feedback loop and angle-to-text approach before committing to the harder real-time path. Locks the feedback format that the rule engine in Phase 3 will key off.
Pitfalls avoided: Pitfall 3 (always-negative feedback — tone must be defined here), Pitfall 5 (exercise-specific pose validation), Pitfall 7 (camera position UX before real-time).
Research flag: Phase-level research recommended for Claude prompt engineering and per-exercise scoring rubric definition.

---

**Phase 3 — Real-Time Form Cues**

The top differentiator. Ship: VisionCamera frame processors, MoveNet Lightning on-device inference, joint angle calculation hook, per-exercise rule engine, live skeleton overlay (Skia), FormCueBanner with throttled Claude text call (max 1 per 30s on sustained deviation), 8–10 FPS inference cap, battery/thermal safeguards.

Features delivered: Live skeleton wireframe + coaching cues during a set.
Why third: Depends on Phase 2 having validated that the angle-detection approach produces coherent feedback. The rule engine thresholds are derived from Phase 2 observations.
Pitfalls avoided: Pitfall 1 (confirmed by Phase 0 spike), Pitfall 7 (battery/thermal — enforce FPS cap from first implementation).
Research flag: Phase-level research recommended for per-exercise rule engine threshold values.

---

**Phase 4 — AI Workout Generation** *(independent — can run parallel to Phase 1–2)*

No dependency on the video pipeline. Ship: goal description input UI, Claude Sonnet 4.6 text call with exercise catalog context, structured output validated against Zod, manual workout builder as the comparison baseline, safety constraints (rest days, volume limits, catalog-only exercise codes), disclaimer UI.

Features delivered: "Describe your goal → get a named workout" + manual workout builder.
Why parallelizable: Touches only the text API path, which shares no infrastructure with the video analysis pipeline. Can be staffed independently or sequenced after Phase 2 if single-threaded.
Pitfalls avoided: Pitfall 6 (unsafe LLM workout progressions).

---

**Phase 5 — Progress Tracking**

Downstream of Phase 2 data existing. Ship: session history list, per-exercise form score trend chart (requires 3+ sessions to be meaningful), overall form trend, ProgressSnapshot aggregation in the analysis worker, server-side aggregation for charts (never send raw session list to client), pagination on session history endpoint.

Features delivered: "See your form arc over time" — the habit loop that justifies continued filming.
Why last: Requires FormFeedback records from Phase 2 to exist. Cannot be meaningfully built or tested before Phase 2 data is in the database.

---

**Phase 6 — User Profile + Notifications** *(can run parallel to Phase 5)*

Ship: user profile (name, avatar, fitness level, goal), profile data wired into AI workout generation prompt context, basic local push notification reminders via Expo.

Features delivered: Personalization anchor + retention mechanic.
Why after Phase 4: AI workout generation quality depends on fitness level + goal context. Profile should be validated against the workout generation prompt before Phase 4 ships if resources allow; otherwise ship profile here and iterate on prompt quality.

---

### Phase Dependency Map

```
Phase 0 (Dev Build Spike) — hard gate
    ↓
Phase 1 (Infrastructure)
    ↓
Phase 2 (Post-Set Analysis) ←── Phase 4 (AI Workout Generation) [parallel]
    ↓
Phase 3 (Real-Time Cues)
    ↓
Phase 5 (Progress Tracking) ←── Phase 6 (Profile + Notifications) [parallel]
```

---

### Research Flags for Roadmapper

| Phase | Research Needed? | Reason |
|-------|-----------------|--------|
| Phase 0 | YES — spike, not research | Verify SDK 54 + VisionCamera + fast-tflite compatibility on both platforms |
| Phase 1 | No | BullMQ + SSE + S3 presigned URLs are well-documented patterns; MEDIUM-HIGH confidence |
| Phase 2 | YES | Claude prompt engineering for per-exercise form analysis; scoring rubric definition; frame sampling strategy for each exercise type |
| Phase 3 | YES | Per-exercise rule engine threshold values; MoveNet accuracy specifically on calisthenics positions (horizontal, inverted, overhead) |
| Phase 4 | No | Claude structured output + workout generation pattern is well-documented; safety constraints are clear |
| Phase 5 | No | Standard aggregation + charting patterns; no novel decisions |
| Phase 6 | No | User profile and push notifications are standard patterns |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Stack — backend (BullMQ, SSE, S3, Claude SDK) | HIGH | Official documentation verified; multiple production examples |
| Stack — mobile camera + upload | HIGH | Official Expo/VisionCamera docs; well-established pattern |
| Stack — on-device ML (VisionCamera + fast-tflite) | MEDIUM | Architecture is well-documented; exact Expo SDK 54 peer-dep resolution unverified until Phase 0 spike |
| Features — table stakes and anti-features | HIGH | Competitor analysis cross-referenced across multiple sources |
| Features — differentiator value | MEDIUM | Based on competitor gap analysis; user validation not yet done |
| Architecture — async job pipeline | HIGH | BullMQ pattern is canonical; well-documented |
| Architecture — frame sampling + Claude vision | HIGH | Officially documented; multi-image support confirmed |
| Architecture — real-time rule engine thresholds | LOW | No validated data on correct angle thresholds for calisthenics exercises yet |
| Pitfalls — Expo compatibility | HIGH | GitHub issues documented; official Expo docs confirm |
| Pitfalls — pose accuracy on horizontal positions | MEDIUM | InfoQ source identifies this; exercise-specific data not yet gathered |
| Pitfalls — feedback tone and churn | MEDIUM | Industry pattern; specific threshold values (0.75 confidence) are estimates |

---

## Gaps to Address During Planning

1. **EAS Build / local native build availability** — The entire real-time analysis path depends on the team being able to run a custom Expo development build. If neither EAS Build nor local Xcode/Android Studio is available, Phase 3 must be redesigned around server-side inference (Path B only). Confirm this before roadmap is finalized.

2. **Per-exercise rule engine thresholds** — What constitutes a "form error" for each of the four exercises (elbow angle bounds, hip drop threshold, chin-over-bar threshold, squat depth) is not established by research and must be defined during Phase 3 planning, ideally with input from a calisthenics coach or validated against exercise physiology literature.

3. **Claude prompt quality for form analysis** — The quality of feedback depends entirely on the exercise-specific system prompts. These are not engineering decisions — they require domain expertise. Phase 2 planning should include prompt development and internal testing as explicit work items, not an afterthought.

4. **MoveNet accuracy on target exercises** — Research identifies push-up down-position and pull-up top-position as high-error scenarios for standard pose models. The Phase 0 spike should include a basic accuracy test on these positions, not just a library installation check.

5. **Redis infrastructure** — BullMQ requires a Redis instance. For early development, Upstash (serverless Redis) is the lowest-overhead option. Confirm infrastructure constraints before Phase 1.

6. **Scoring rubric definition** — The FormFeedback schema must include a consistent scoring rubric before Phase 2 ships. A score of 72/100 means nothing without defined dimensions (ROM, stability, symmetry). Define the rubric in Phase 2 planning; it must be consistent enough to trend over time for Phase 5.

---

## Sources (Aggregated)

**Architecture and Stack:**
- Anthropic Models Overview (verified March 2026): https://platform.claude.com/docs/en/about-claude/models/overview
- Anthropic Vision API documentation: https://platform.claude.com/docs/en/build-with-claude/vision
- Anthropic Structured Outputs (November 2025): https://techbytes.app/posts/claude-structured-outputs-json-schema-api/
- react-native-fast-tflite GitHub: https://github.com/mrousavy/react-native-fast-tflite
- react-native-vision-camera frame processor docs: https://react-native-vision-camera.com/docs/guides/frame-processor-plugins-community
- TensorFlow MoveNet README: https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/movenet/README.md
- BullMQ documentation: https://docs.bullmq.io
- AWS SDK v3 S3 presigned URL: https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
- Real-world fitness app using Claude + pose estimation (Dev.to, 2025): https://dev.to/godlymane11/how-i-built-real-time-ai-form-correction-into-a-mobile-fitness-app-3k09

**Features and Competitors:**
- Best Calisthenics Apps 2026: https://www.bestaifitnessapp.com/blog/best-calisthenics-workout-app
- Gymscore AI Form Analysis: https://www.gymscore.ai/
- ChAIron AI Training: https://chairon.app/
- Challenges of Pose Estimation in AI Fitness Apps (InfoQ): https://www.infoq.com/articles/human-pose-estimation-ai-powered-fitness-apps/

**Pitfalls:**
- expo-camera / tfjs-react-native incompatibility (Expo SDK 51, GitHub Issue #30060): https://github.com/expo/expo/issues/30060
- react-native-background-upload (Vydia): https://github.com/Vydia/react-native-background-upload
- LLMs in Exercise Prescription (PubMed/PMC12133071): https://pmc.ncbi.nlm.nih.gov/articles/PMC12133071/
- AI Power Drain and Battery Limits (Enovix): https://enovix.com/the-ai-power-drain-why-battery-limitations-threaten-the-future-of-mobile-ai/
- Existing codebase CONCERNS.md (direct code audit): HIGH confidence

---

*Synthesized by: gsd-synthesizer*
*Date: 2026-03-21*
