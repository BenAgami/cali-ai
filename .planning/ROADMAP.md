# Roadmap: Cali AI

## Overview

The project delivers its core value — AI-powered calisthenics form feedback — through a strictly ordered pipeline. Infrastructure comes first because every AI feature depends on async job processing and session state management. User profile and manual workout builder lay the foundation for AI workout generation. Post-set form analysis validates the full Claude feedback loop before committing to the harder real-time path. Progress tracking closes the loop last, reading from data that only exists after form analysis has run.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure** - Async job pipeline, keypoint capture endpoint, SSE, session state machine, and custom Expo dev build (completed 2026-11-08)
- [x] **Phase 2: User Profile** - Display name, avatar, fitness level, goal, and workout reminder notifications (completed 2026-04-03)
- [x] **Phase 3: Manual Workout Builder** - Browse exercises, create and edit named workouts, start workout sessions (completed 2026-06-19)
- [x] **Phase 4: AI Workout Generation** - Goal-to-workout via Claude Sonnet, catalog-validated structured output (completed 2026-11-04)
- [ ] **Phase 5: AI Form Analysis** - Camera open during set; on-device keypoints auto-submitted when set ends; form band + coaching feedback
- [ ] **Phase 5.1: Training Data & Labeling** (INSERTED) - Consent, retention, form labels, spot-check tool; foundation for training an own model
- [ ] **Phase 6: Real-Time Form Cues** (DEFERRED — future milestone, not in v1) - Live audio/visual coaching cues from on-device pose estimation
- [ ] **Phase 7: Progress Tracking** - Session history, per-exercise form score trends, overall form arc over time

## Phase Details

### Phase 1: Infrastructure

**Goal**: The async analysis pipeline (keypoints in, no video), session state machine, and custom Expo dev build are in place — every AI feature that follows can be built on top of a correct, non-blocking foundation
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):

1. A POST to the keypoint capture endpoint (`/api/sessions/:id/capture`) returns 202 with a job ID in under 500 ms for a typical set (~25-60 KB compressed)
2. A BullMQ worker picks up the job and processes it asynchronously without blocking the HTTP handler
3. The client receives SSE events as the job progresses from QUEUED through PROCESSING to COMPLETED or FAILED
4. A WorkoutSession that enters PROCESSING state advances to COMPLETED or rolls back to FAILED within 3 minutes — it never stays stuck in PROCESSING indefinitely
5. react-native-vision-camera and react-native-fast-tflite run in a custom Expo dev build on Android without crashing (pose pass runs on a test image or video), and the iOS simulator build compiles on EAS; iOS runtime verification is deferred
6. MoveNet (and a 33-point alternative) is checked on real clips of the four core exercises (push-up down position, pull-up top position, dip, squat), and the result decides the pose model
   **Plans:** 10/10 plans complete

Plans:

- [x] 01-01-PLAN.md — Prisma migration (PoseCapture, AnalysisStage columns, drop video columns), video-field removal, queue renamed to form-analysis
- [x] 01-02-PLAN.md — Status-event contract + stage-to-percent mapping, analysis env config with retry-budget and 3-minute-ceiling checks (150 s stuck timeout, 15 s reaper tick), Redis pub/sub progress bus
- [x] 01-03-PLAN.md — Dev-build gate: worklets-core + MoveNet pose-check screen, Android + iOS-simulator EAS builds, device verification
- [x] 01-04-PLAN.md — Pose-model gate: offline evaluator, shot list, filmed clips, MoveNet vs 33-point decision (BlazePose Full chosen)
- [x] 01-05-PLAN.md — Session state machine service (guarded transitions, reaper query) with unit + real-DB tests
- [x] 01-06-PLAN.md — Capture payload schema + caps, gzip storage codec, withTimeout utility
- [x] 01-07-PLAN.md — POST /api/sessions/:id/capture and /analysis/retry (202 + job id, 409/413 rules) with integration tests
- [x] 01-08-PLAN.md — BullMQ analysis worker, retries/backoff, LLM-timeout seam, reaper job scheduler (every 15 s), startup/shutdown wiring
- [x] 01-09-PLAN.md — GET /api/sessions/:id/status SSE stream via analysisStreamService (current state first, live pub/sub events, terminal close), thin controller
- [x] 01-10-PLAN.md — Native sessions API (gzip upload), react-native-sse status hook, dev pipeline-check screen, end-to-end device check

### Phase 2: User Profile

**Goal**: Users can personalise their account with a display name, avatar, fitness level, and primary goal — and the profile data is available to downstream AI features that need it for calibration
**Depends on**: Phase 1
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, NOTF-01
**Success Criteria** (what must be TRUE):

1. User can set and update a display name and avatar from their profile screen
2. User can select a fitness level (beginner / intermediate / advanced) and it persists across sessions
3. User can set a primary goal in free text and it persists across sessions
4. Profile edits are reflected immediately on the profile screen without requiring a logout/login cycle
5. User can schedule a local workout reminder notification and it fires at the chosen time
   **Plans:** 3/3 plans complete

Plans:

- [x] 02-01-PLAN.md — Schema migration, Zod schemas, API endpoints (PATCH /me, POST /me/avatar-upload-url, POST /me/goals), integration tests
- [x] 02-02-PLAN.md — Native profile screens: AvatarDisplay, Home header, read-only profile, edit form with avatar upload
- [x] 02-03-PLAN.md — Workout reminder notifications: expo-notifications hook, ReminderCard widget on Home screen

### Phase 3: Manual Workout Builder

**Goal**: Users can browse the exercise catalog, assemble named workouts with sets/reps/rest, and start a workout session from a saved workout
**Depends on**: Phase 2
**Requirements**: WKT-01, WKT-02, WKT-03, WKT-04
**Success Criteria** (what must be TRUE):

1. User can browse the exercise catalog and open a detail view for any exercise
2. User can create a named workout by picking exercises and configuring sets, reps, and rest per exercise
3. User can edit an existing workout and delete a workout they no longer want
4. User can start a workout session from any saved workout and the session is recorded
   **Plans**: TBD

### Phase 4: AI Workout Generation

**Goal**: Users can describe a fitness goal in natural language and receive a ready-to-use workout plan that only references exercises in the seeded catalog and respects their fitness level and primary goal from their profile
**Depends on**: Phase 3 (baseline for comparison), Phase 2 (profile context for calibration)
**Requirements**: WKT-05, WKT-06, WKT-07, PROF-06
**Success Criteria** (what must be TRUE):

1. User can enter a natural language goal description and receive a named, structured workout plan
2. Every exercise in the AI-generated plan exists in the exercise catalog — no hallucinated exercise names are accepted
3. The generated workout visibly adapts to the user's fitness level and primary goal from their profile (a beginner gets a different plan than an advanced user for the same goal)
4. A disclaimer is shown on every AI-generated plan before the user starts it
   **Plans:** 11 plans

Plans:

- [x] 04-01-PLAN.md — Prisma migration (nullable level, AI consent, WorkoutGeneration, Workout provenance), dip seed, ApiError code + 428/429 errors, LLM/generation env vars
- [x] 04-02-PLAN.md — Shared @repo/common contracts (body metrics, AI prerequisites/consent, generation preview, workout provenance) and nullable-level ripple
- [x] 04-03-PLAN.md — bodyMetricService (append-only, skip unchanged), shared AI prerequisite gate, POST /me/body-metrics and /me/ai-consent, extended GET /me
- [x] 04-04-PLAN.md — LlmProvider interface, Anthropic structured-output adapter with error normalization, versioned prompt builder
- [x] 04-05-PLAN.md — validateGeneratedPlan + workoutGenerationService (gate, daily cap, in-flight guard, Haiku/Haiku/Sonnet ladder, generation row)
- [x] 04-06-PLAN.md — POST /api/workouts/generate, save-with-provenance on POST /api/workouts, OpenAPI, integration tests
- [x] 04-07-PLAN.md — Native ApiError code + timeouts, shared BodyMetricsForm with region units, onboarding step, profile-edit height/weight
- [x] 04-08-PLAN.md — Native Generate with AI screen: inline prerequisites, privacy notice, goal chips, preview with disclaimer, Save/Regenerate
- [x] 04-09-PLAN.md — Golden-set eval of Haiku vs Sonnet (D-22), latency/token spike, model default decision
- [x] 04-10-PLAN.md — Edit-in-builder hand-off keeping AI provenance, disclaimer on Start for AI workouts
- [x] 04-11-PLAN.md — Full CI gates, docs update, on-device verification checkpoint

### Phase 5: AI Form Analysis (Camera + Post-Set)

**Goal**: Users can choose to record a set; the camera and on-device pose estimation run only for recorded sets, and when such a set ends the keypoints are automatically analyzed (metrics → LLM) — user receives a form band, dimension breakdown, and rep-level coaching text with no manual upload step
**Depends on**: Phase 1
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, FORM-06, FORM-07, FORM-08, FORM-09, PROF-07, NOTF-02
**Success Criteria** (what must be TRUE):

1. User selects an exercise (push-up, pull-up, dip, or squat), is offered the option to record the set, the camera opens only if they accept, and the keypoints are automatically submitted when the recorded set ends — no upload screen. A set they decline to record is logged without analysis
2. User receives a form band (5 levels) and a breakdown by dimension (range of motion, core stability, symmetry) when analysis completes; the 0-100 score is stored but not shown per set
3. Feedback text references specific reps and leads with at least one positive observation before corrections; no more than 2 corrections are surfaced per set
4. User receives an in-app notification and the feedback screen updates automatically when analysis is complete — no manual refresh required
5. A failed analysis (worker error, network loss) presents a retry option rather than a silent dead end
6. When the body cannot be tracked reliably, the user sees camera advice instead of feedback
   **Plans:** 12/18 plans executed

Plans:

- [x] 05-01-PLAN.md — Wave 0 gate: on-device BlazePose spike (MediaPipe PoseLandmarker plugin, Android), PoseFrame contract, runtime decision
- [x] 05-02-PLAN.md — Rubric v0 document (tags, thresholds, ramps, bands, trackability, daily cap 15, per-exercise-per-workout cap 2) and user approval (D-13)
- [x] 05-03-PLAN.md — Prisma migration: WorkoutSession workoutId/setNumber, AnalysisOutcome, nullable formScore, untrackableReasons, finding repNumbers
- [x] 05-04-PLAN.md — @repo/common contracts: supported exercises, bands, dimensions, untrackable advice, result/recorded-set shapes, aspectRatio + quantizeCapture, consent version bump
- [x] 05-05-PLAN.md — Skeleton fixtures from the 16 Phase 1 clips (dump script, manifest, loader)
- [x] 05-06-PLAN.md — Metrics foundation: types, geometry, preprocessing, rep segmentation, trackability preflight, synthetic skeletons
- [x] 05-07-PLAN.md — Session creation as recorded-set entry (supported exercises, workout link, consent gate), processingStatus filter, no formScore in lists
- [x] 05-08-PLAN.md — Native endpoints/query hooks, global AnalysisTrackerContext with SSE watchers and completion banner
- [x] 05-09-PLAN.md — Per-exercise rubric modules (push-up, dip, squat, pull-up)
- [x] 05-10-PLAN.md — LLM form feedback: provider method, versioned prompt, validator + repair, typed timeout codes
- [x] 05-11-PLAN.md — Capture consent gate + daily cap (15) and per-exercise-per-workout cap (2); GET /sessions/:id/analysis and /workouts/:id/recorded-sets
- [x] 05-12-PLAN.md — Result UI: band badge, dimension rows, feedback blocks, camera advice, analysis-result screen, Recorded sets section
- [x] 05-13-PLAN.md — Recording engine: pure setup check + payload builder, pose source, useRecordedSet state machine
- [x] 05-14-PLAN.md — Scoring, finding selection, computeFormMetrics with golden fixture tests
- [x] 05-15-PLAN.md — Record offer in workout run, record-set screen with framing guide, shared AI prerequisite steps
- [x] 05-16-PLAN.md — Worker pipeline: metrics -> LLM (AbortSignal) -> guarded idempotent persist; end-to-end integration tests
- [ ] 05-17-PLAN.md — Rubric calibration on the 16 clips with the user, rubric-v1
- [ ] 05-18-PLAN.md — CI gates, docs, STATE updates, Android device UAT

### Phase 5.1: Training Data & Labeling (INSERTED)

**Goal**: Every analysis produces a versioned label, consented sets keep their keypoints for future training, and the owner can spot-check the LLM's scores — the foundation for training an in-house form model
**Depends on**: Phase 5
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):

1. User is asked for opt-in consent and can withdraw it; the app respects the current state
2. Sets from non-consented users keep no raw keypoints after analysis completes
3. Each analysis stores a label with score bucket, error tags, and the model, prompt, rubric and metrics versions
4. The owner can open a skeleton replay next to its score and record whether they agree
5. The same stored input run through the LLM several times produces a measured agreement rate
6. A consented capture stores a context snapshot (body, exercise variation, set, capture quality, outcome signals) that does not change when the profile later does
   **Plans**: TBD

### Phase 6: Real-Time Form Cues (DEFERRED)

**Status**: Deferred to a future milestone. Kept here for reference; skipped in execution order and not counted in v1.

**Goal**: The camera session established in Phase 5 gains a live overlay — on-device pose estimation fires instant cues for form deviations during the set, complementing the deep analysis that runs after
**Depends on**: Phase 5 (same camera session; validates angle-detection approach and feedback format before real-time rule engine is built on top)
**Requirements**: RT-01, RT-02, RT-03, RT-04 (moved to v2 in REQUIREMENTS.md)
**Success Criteria** (what must be TRUE):

1. User can toggle real-time form cues on before starting a set and the live skeleton overlay appears on the camera feed
2. A form deviation (e.g. elbow flare, hip drop, insufficient depth) triggers an audio or visual cue within 2 seconds of the deviation occurring
3. Cues are non-intrusive — they appear as a banner or audio prompt without covering the camera feed or pausing the set
4. Pose inference runs at capped frame rate (8-10 FPS) and the device remains responsive for the full duration of a 15-minute session without thermal throttling
   **Plans**: TBD

### Phase 7: Progress Tracking

**Goal**: Users can see their form arc over time — session history, per-exercise form score trends, and an overall trend chart that turns one-off analyses into a visible coaching relationship
**Depends on**: Phase 5 (FormFeedback records must exist in the database)
**Requirements**: PROG-01, PROG-02, PROG-03, PROG-04
**Success Criteria** (what must be TRUE):

1. User can view a paginated history of all completed workout sessions
2. User can view a chart showing their form score trend for a specific exercise across sessions (requires at least 3 sessions to render a trend line; the line is smoothed over several sets so one noisy score does not look like a drop)
3. User can view an overall form score trend across all exercises and sessions (smoothed the same way)
4. A user with fewer than 3 sessions sees an empty state that explains what will appear once enough data exists, rather than a blank or broken chart
   **Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 5.1 -> 7 (Phase 6 is deferred)

| Phase                        | Plans Complete | Status      | Completed  |
| ---------------------------- | -------------- | ----------- | ---------- |
| 1. Infrastructure            | 10/10          | Complete    | 2026-11-08 |
| 2. User Profile              | 3/3            | Complete    | 2026-04-03 |
| 3. Manual Workout Builder    | 9/9            | Complete    | 2026-06-19 |
| 4. AI Workout Generation     | 11/11          | Complete    | 2026-11-04 |
| 5. Post-Set AI Form Analysis | 12/18 | In Progress|  |
| 5.1 Training Data & Labeling | 0/TBD          | Not started | -          |
| 6. Real-Time Form Cues       | 0/TBD          | Deferred    | -          |
| 7. Progress Tracking         | 0/TBD          | Not started | -          |

### Phase 8: Designing the user UI and UX

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 7
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 8 to break down)

## Backlog

### Phase 999.1: Rerun the Haiku workout-generation eval (BACKLOG)

**Goal:** Rerun `yarn workspace api eval:workouts` to separate provider flakiness from plan quality (5 of 12 Haiku calls timed out or were unavailable in the 2026-11-04 run). Revisit making Haiku the primary model (about 19x cheaper, roughly $0.005 saved per generation) only if real traffic makes generation cost meaningful. See `.planning/phases/04-ai-workout-generation/04-EVAL-RESULTS.md`.
**Requirements:** TBD
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.2: Auto-detect end of motion for recorded sets (BACKLOG)

**Goal:** Stop a recorded set automatically when no movement is detected for a few seconds, instead of requiring a manual Stop tap. Deferred from the Phase 5 discussion (Phase 5 uses manual Stop, D-02); risk to weigh is cutting a slow set or ending early on a hold.
**Requirements:** TBD
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd:review-backlog when ready)
