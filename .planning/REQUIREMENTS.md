# Requirements: Cali AI

**Defined:** 2026-03-21
**Core Value:** Users can record themselves doing calisthenics exercises and get actionable AI feedback on their form — what they did well and what to fix.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: Redis + BullMQ async job queue is set up for form-analysis processing (keypoints in, LLM feedback out)
- [ ] **INFRA-02**: Set keypoints (no video) are automatically submitted for analysis when the set ends; the endpoint returns a job ID and processes asynchronously
- [ ] **INFRA-03**: Server-Sent Events (SSE) endpoint delivers job progress and results to the client
- [ ] **INFRA-04**: Workout session processingStatus state machine handles PENDING → PROCESSING → COMPLETED / FAILED transitions
- [ ] **INFRA-05**: Custom Expo dev build is configured with react-native-vision-camera and react-native-fast-tflite (required for on-device pose estimation)

### User Profile

- [x] **PROF-01**: User can set a display name
- [x] **PROF-02**: User can upload an avatar image
- [x] **PROF-03**: User can set fitness level (beginner / intermediate / advanced)
- [x] **PROF-04**: User can set a primary goal (e.g. "build strength", "learn handstand", "lose weight")
- [x] **PROF-05**: User can view and edit their profile
- [ ] **PROF-06**: User must provide their height (cm) and weight (kg), both together, before using any AI feature (workout generation or form analysis); they can update them later, and each submission is kept as a new `body_metrics` entry (the latest is the current value)
- [ ] **PROF-07**: The latest height and weight are included in the LLM context for workout generation and form feedback. The privacy notice states that profile data is sent to the LLM provider

### Workout Builder

- [x] **WKT-01**: User can browse the exercise catalog and view exercise details
- [x] **WKT-02**: User can create a named workout by selecting exercises and setting sets, reps, and rest
- [x] **WKT-03**: User can edit and delete their saved workouts
- [x] **WKT-04**: User can start a workout session from a saved workout
- [ ] **WKT-05**: User can generate a workout from a natural language goal description (AI-generated)
- [ ] **WKT-06**: AI-generated workouts are validated against the exercise catalog (no hallucinated exercise names)
- [ ] **WKT-07**: AI-generated workouts respect user fitness level and goal from profile

### AI Form Analysis — Post-Set

- [ ] **FORM-01**: User selects an exercise before recording (push-up, pull-up, dip, squat)
- [ ] **FORM-02**: User is offered the option to record a set for form analysis; the camera opens only when they accept, never automatically. Declining still lets them log the set normally. On-device pose estimation starts when recording starts
- [ ] **FORM-03**: When a recorded set ends, the keypoints are automatically submitted and a job ID is returned — no manual upload step. Sets that were not recorded are never submitted
- [ ] **FORM-04**: User receives a form band (5 levels, e.g. Excellent / Good / Fair / Needs work / Poor) per set after analysis completes. A 0–100 score is stored with each result for trend charts, labeling and relabeling, but is not shown per set
- [ ] **FORM-05**: Form band includes a breakdown by dimension (e.g. range of motion, core stability, symmetry)
- [ ] **FORM-06**: User receives actionable text feedback referencing specific reps
- [ ] **FORM-07**: Feedback leads with positives before corrections; max 2 corrections per set
- [ ] **FORM-08**: User is notified when analysis is complete (SSE progress → result)
- [ ] **FORM-09**: When the body cannot be tracked reliably (low keypoint confidence), the user gets camera advice instead of feedback

### Training Data

- [ ] **DATA-01**: User is asked for explicit opt-in consent to keep pose data for model training; consent can be withdrawn
- [ ] **DATA-02**: Raw keypoints are kept only for consented sets; non-consented sets keep only the result
- [ ] **DATA-03**: Every analysis stores a label (score bucket and error tags) with the model, prompt, rubric and metrics versions
- [ ] **DATA-04**: Owner can spot-check a sample of sets by viewing a skeleton replay next to the score and record agreement
- [ ] **DATA-05**: For consented sets, each capture stores a context snapshot taken at capture time (versioned), so later changes to the profile do not alter past records:
  - Body and profile: height, weight, experience level, goal type
  - Exercise: exercise code, variation or progression stage (e.g. tuck, straddle), equipment (bar, rings, parallettes), assisted yes/no, added weight
  - Set: set number in the session, planned reps or hold time, reps or hold time detected, rest before the set, time of day
  - Capture quality: camera view, phone orientation, fps, device model, OS and app version, pose model and version, mean keypoint confidence, share of dropped frames
  - Outcome signals: optional perceived effort after the set, the user's rating of the feedback, whether the previous set's flagged error recurred

### Progress Tracking

- [ ] **PROG-01**: User can view a history of all workout sessions
- [ ] **PROG-02**: User can view per-exercise form score trend over time (chart, smoothed over several sets)
- [ ] **PROG-03**: User can view overall form score trend across sessions (smoothed the same way)
- [ ] **PROG-04**: Empty states guide new users before enough data exists for charts

### Notifications

- [x] **NOTF-01**: User can schedule local workout reminder notifications
- [ ] **NOTF-02**: User receives an in-app notification when post-set analysis is complete

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Offline Mode

- **OFFL-01**: User can download a workout for offline execution
- **OFFL-02**: Session data recorded offline syncs when connectivity is restored

### Expanded AI Coverage

- **EXCOV-01**: AI form analysis supports additional exercises beyond core 4
- **EXCOV-02**: Per-exercise scoring rubrics are defined and validated by domain experts

### Real-Time Form Cues

- **RT-01**: User can enable real-time form cues during a set (live camera mode)
- **RT-02**: On-device pose estimation runs at real-time frame rate via TFLite
- **RT-03**: Live audio or visual cue fires when a form deviation is detected
- **RT-04**: Real-time cues are non-intrusive and do not interrupt set flow

### Social

- **SOCL-01**: User can share a form band card via native share sheet
- **SOCL-02**: No in-app social feed — native share sheet only

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                                   | Reason                                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Video upload and hosting                  | Pose runs on the phone; the server receives keypoints only. Video is cheaper and more private to keep on the device.                   |
| Gallery video import                      | Needs frame decoding of saved files, which React Native lacks a good option for. v1 analyzes live capture only.                        |
| Auto-detect exercise from video           | Pose estimation alone cannot reliably distinguish bodyweight movements (~60-70% accuracy). User must select exercise before recording. |
| In-app social feed                        | Social content moderation + feed ranking is a separate product. Dilutes focus from AI coaching.                                        |
| Nutrition / meal planning                 | Regulated domain, doubles product surface, does not advance core value                                                                 |
| Wearable integration                      | Adds third SDK surface; biometric data doesn't improve form analysis quality                                                           |
| Live video streaming / virtual trainer    | WebRTC + server-side real-time AI inference is extreme infrastructure complexity                                                       |
| Full exercise catalog AI coverage (2500+) | Deep accuracy on 4 core moves beats shallow coverage on hundreds                                                                       |
| Web app as primary surface                | Mobile-first; Next.js app remains a placeholder                                                                                        |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase   | Status   |
| ----------- | ------- | -------- |
| INFRA-01    | Phase 1 | Pending  |
| INFRA-02    | Phase 1 | Pending  |
| INFRA-03    | Phase 1 | Pending  |
| INFRA-04    | Phase 1 | Pending  |
| INFRA-05    | Phase 1 | Pending  |
| PROF-01     | Phase 2 | Complete |
| PROF-02     | Phase 2 | Complete |
| PROF-03     | Phase 2 | Complete |
| PROF-04     | Phase 2 | Complete |
| PROF-05     | Phase 2 | Complete |
| PROF-06     | Phase 4 | Pending  |
| PROF-07     | Phase 5 | Pending  |
| WKT-01      | Phase 3 | Complete |
| WKT-02      | Phase 3 | Complete |
| WKT-03      | Phase 3 | Complete |
| WKT-04      | Phase 3 | Complete |
| WKT-05      | Phase 4 | Pending  |
| WKT-06      | Phase 4 | Pending  |
| WKT-07      | Phase 4 | Pending  |
| FORM-01     | Phase 5 | Pending  |
| FORM-02     | Phase 5 | Pending  |
| FORM-03     | Phase 5 | Pending  |
| FORM-04     | Phase 5 | Pending  |
| FORM-05     | Phase 5 | Pending  |
| FORM-06     | Phase 5 | Pending  |
| FORM-07     | Phase 5 | Pending  |
| FORM-08     | Phase 5 | Pending  |
| FORM-09     | Phase 5 | Pending  |
| DATA-01     | Phase 5.1 | Pending  |
| DATA-02     | Phase 5.1 | Pending  |
| DATA-03     | Phase 5.1 | Pending  |
| DATA-04     | Phase 5.1 | Pending  |
| DATA-05     | Phase 5.1 | Pending  |
| PROG-01     | Phase 7 | Pending  |
| PROG-02     | Phase 7 | Pending  |
| PROG-03     | Phase 7 | Pending  |
| PROG-04     | Phase 7 | Pending  |
| NOTF-01     | Phase 2 | Complete |
| NOTF-02     | Phase 5 | Pending  |

**Coverage:**

- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0 ✓

---

_Requirements defined: 2026-03-21_
_Last updated: 2026-03-21 after initial definition_
