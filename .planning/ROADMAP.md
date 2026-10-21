# Roadmap: Cali AI

## Overview

The project delivers its core value — AI-powered calisthenics form feedback — through a strictly ordered pipeline. Infrastructure comes first because every AI feature depends on async job processing and session state management. User profile and manual workout builder lay the foundation for AI workout generation. Post-set form analysis validates the full Claude feedback loop before committing to the harder real-time path. Progress tracking closes the loop last, reading from data that only exists after form analysis has run.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Infrastructure** - Async job pipeline, keypoint capture endpoint, SSE, session state machine, and custom Expo dev build
- [x] **Phase 2: User Profile** - Display name, avatar, fitness level, goal, and workout reminder notifications (completed 2026-04-03)
- [x] **Phase 3: Manual Workout Builder** - Browse exercises, create and edit named workouts, start workout sessions (completed 2026-06-19)
- [ ] **Phase 4: AI Workout Generation** - Goal-to-workout via Claude Sonnet, catalog-validated structured output
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
4. A WorkoutSession that enters PROCESSING state advances to COMPLETED or rolls back to FAILED within 10 minutes — it never stays stuck in PROCESSING indefinitely
5. react-native-vision-camera and react-native-fast-tflite run in a custom Expo dev build on both iOS and Android simulators without crashing
6. MoveNet (and a 33-point alternative) is checked on real clips of the four core exercises (push-up down position, pull-up top position, dip, squat), and the result decides the pose model
   **Plans**: TBD

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
   **Plans**: TBD

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
   **Plans**: TBD

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
| 1. Infrastructure            | 0/TBD          | In progress | -          |
| 2. User Profile              | 3/3            | Complete    | 2026-04-03 |
| 3. Manual Workout Builder    | 9/9            | Complete    | 2026-06-19 |
| 4. AI Workout Generation     | 0/TBD          | Not started | -          |
| 5. Post-Set AI Form Analysis | 0/TBD          | Not started | -          |
| 5.1 Training Data & Labeling | 0/TBD          | Not started | -          |
| 6. Real-Time Form Cues       | 0/TBD          | Deferred    | -          |
| 7. Progress Tracking         | 0/TBD          | Not started | -          |
