# Roadmap: Cali AI

## Overview

The project delivers its core value — AI-powered calisthenics form feedback — through a strictly ordered pipeline. Infrastructure comes first because every AI feature depends on async job processing and session state management. User profile and manual workout builder lay the foundation for AI workout generation. Post-set form analysis validates the full Claude feedback loop before committing to the harder real-time path. Progress tracking closes the loop last, reading from data that only exists after form analysis has run.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Infrastructure** - Async job pipeline, video upload, SSE, session state machine, and custom Expo dev build
- [ ] **Phase 2: User Profile** - Display name, avatar, fitness level, goal, and workout reminder notifications
- [ ] **Phase 3: Manual Workout Builder** - Browse exercises, create and edit named workouts, start workout sessions
- [ ] **Phase 4: AI Workout Generation** - Goal-to-workout via Claude Sonnet, catalog-validated structured output
- [ ] **Phase 5: Post-Set AI Form Analysis** - Record a set, upload video, receive form score and coaching feedback
- [ ] **Phase 6: Real-Time Form Cues** - On-device MoveNet pose estimation with live audio/visual coaching cues
- [ ] **Phase 7: Progress Tracking** - Session history, per-exercise form score trends, overall form arc over time

## Phase Details

### Phase 1: Infrastructure
**Goal**: The async video analysis pipeline, session state machine, and custom Expo dev build are in place — every AI feature that follows can be built on top of a correct, non-blocking foundation
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. A POST to the video upload endpoint returns 202 with a job ID in under 500 ms regardless of file size
  2. A BullMQ worker picks up the job and processes it asynchronously without blocking the HTTP handler
  3. The client receives SSE events as the job progresses from QUEUED through PROCESSING to COMPLETED or FAILED
  4. A WorkoutSession that enters PROCESSING state advances to COMPLETED or rolls back to FAILED within 10 minutes — it never stays stuck in PROCESSING indefinitely
  5. react-native-vision-camera and react-native-fast-tflite run in a custom Expo dev build on both iOS and Android simulators without crashing
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
**Plans**: TBD

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
**Requirements**: WKT-05, WKT-06, WKT-07
**Success Criteria** (what must be TRUE):
  1. User can enter a natural language goal description and receive a named, structured workout plan
  2. Every exercise in the AI-generated plan exists in the exercise catalog — no hallucinated exercise names are accepted
  3. The generated workout visibly adapts to the user's fitness level and primary goal from their profile (a beginner gets a different plan than an advanced user for the same goal)
  4. A disclaimer is shown on every AI-generated plan before the user starts it
**Plans**: TBD

### Phase 5: Post-Set AI Form Analysis
**Goal**: Users can record a set, upload the video, and receive an actionable form score with a breakdown and coaching text — the complete Claude form feedback loop is validated end-to-end on all four core exercises
**Depends on**: Phase 1
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, FORM-06, FORM-07, FORM-08, NOTF-02
**Success Criteria** (what must be TRUE):
  1. User selects an exercise (push-up, pull-up, dip, or squat), records a set, and the video is uploaded and acknowledged with a job ID immediately
  2. User receives a numeric form score (0–100) and a breakdown by dimension (range of motion, core stability, symmetry) when analysis completes
  3. Feedback text references specific reps and leads with at least one positive observation before corrections; no more than 2 corrections are surfaced per set
  4. User receives an in-app notification and the feedback screen updates automatically when analysis is complete — no manual refresh required
  5. A failed analysis (worker error, network loss) presents a retry option rather than a silent dead end
**Plans**: TBD

### Phase 6: Real-Time Form Cues
**Goal**: Users can enable live form coaching during a set — on-device pose estimation fires instant deterministic cues for detected deviations without disrupting the flow of the set
**Depends on**: Phase 5 (validates angle-detection approach and feedback format before real-time commit; Phase 1 for custom dev build)
**Requirements**: RT-01, RT-02, RT-03, RT-04
**Success Criteria** (what must be TRUE):
  1. User can toggle real-time form cues on before starting a set and the live skeleton overlay appears on the camera feed
  2. A form deviation (e.g. elbow flare, hip drop, insufficient depth) triggers an audio or visual cue within 2 seconds of the deviation occurring
  3. Cues are non-intrusive — they appear as a banner or audio prompt without covering the camera feed or pausing the set
  4. Pose inference runs at capped frame rate (8–10 FPS) and the device remains responsive for the full duration of a 15-minute session without thermal throttling
**Plans**: TBD

### Phase 7: Progress Tracking
**Goal**: Users can see their form arc over time — session history, per-exercise form score trends, and an overall trend chart that turns one-off analyses into a visible coaching relationship
**Depends on**: Phase 5 (FormFeedback records must exist in the database)
**Requirements**: PROG-01, PROG-02, PROG-03, PROG-04
**Success Criteria** (what must be TRUE):
  1. User can view a paginated history of all completed workout sessions
  2. User can view a chart showing their form score trend for a specific exercise across sessions (requires at least 3 sessions to render a trend line)
  3. User can view an overall form score trend across all exercises and sessions
  4. A user with fewer than 3 sessions sees an empty state that explains what will appear once enough data exists, rather than a blank or broken chart
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure | 0/TBD | Not started | - |
| 2. User Profile | 0/TBD | Not started | - |
| 3. Manual Workout Builder | 0/TBD | Not started | - |
| 4. AI Workout Generation | 0/TBD | Not started | - |
| 5. Post-Set AI Form Analysis | 0/TBD | Not started | - |
| 6. Real-Time Form Cues | 0/TBD | Not started | - |
| 7. Progress Tracking | 0/TBD | Not started | - |
