# Requirements: Cali AI

**Defined:** 2026-03-21
**Core Value:** Users can record themselves doing calisthenics exercises and get actionable AI feedback on their form — what they did well and what to fix.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: Redis + BullMQ async job queue is set up for video analysis processing
- [ ] **INFRA-02**: Set recording is automatically submitted for analysis when the set ends; returns a job ID and processes asynchronously
- [ ] **INFRA-03**: Server-Sent Events (SSE) endpoint delivers job progress and results to the client
- [ ] **INFRA-04**: Workout session processingStatus state machine handles PENDING → PROCESSING → COMPLETED / FAILED transitions
- [ ] **INFRA-05**: Custom Expo dev build is configured with react-native-vision-camera (required for real-time analysis)

### User Profile

- [x] **PROF-01**: User can set a display name
- [x] **PROF-02**: User can upload an avatar image
- [x] **PROF-03**: User can set fitness level (beginner / intermediate / advanced)
- [x] **PROF-04**: User can set a primary goal (e.g. "build strength", "learn handstand", "lose weight")
- [x] **PROF-05**: User can view and edit their profile

### Workout Builder

- [ ] **WKT-01**: User can browse the exercise catalog and view exercise details
- [ ] **WKT-02**: User can create a named workout by selecting exercises and setting sets, reps, and rest
- [ ] **WKT-03**: User can edit and delete their saved workouts
- [ ] **WKT-04**: User can start a workout session from a saved workout
- [ ] **WKT-05**: User can generate a workout from a natural language goal description (AI-generated)
- [ ] **WKT-06**: AI-generated workouts are validated against the exercise catalog (no hallucinated exercise names)
- [ ] **WKT-07**: AI-generated workouts respect user fitness level and goal from profile

### AI Form Analysis — Post-Set

- [ ] **FORM-01**: User selects an exercise before recording (push-up, pull-up, dip, squat)
- [ ] **FORM-02**: Camera opens automatically when a set begins; recording starts without a separate action
- [ ] **FORM-03**: When the set ends, the recording is automatically submitted and returns a job ID — no manual upload step
- [ ] **FORM-04**: User receives a form score (0–100) per set after analysis completes
- [ ] **FORM-05**: Form score includes a breakdown by dimension (e.g. range of motion, core stability, symmetry)
- [ ] **FORM-06**: User receives actionable text feedback referencing specific reps
- [ ] **FORM-07**: Feedback leads with positives before corrections; max 2 corrections per set
- [ ] **FORM-08**: User is notified when analysis is complete (SSE progress → result)

### AI Form Analysis — Real-Time

- [ ] **RT-01**: User can enable real-time form cues during a set (live camera mode)
- [ ] **RT-02**: On-device pose estimation runs at real-time frame rate via TFLite
- [ ] **RT-03**: Live audio or visual cue fires when a form deviation is detected
- [ ] **RT-04**: Real-time cues are non-intrusive and do not interrupt set flow

### Progress Tracking

- [ ] **PROG-01**: User can view a history of all workout sessions
- [ ] **PROG-02**: User can view per-exercise form score trend over time (chart)
- [ ] **PROG-03**: User can view overall form score trend across sessions
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

### Social

- **SOCL-01**: User can share a form score card via native share sheet
- **SOCL-02**: No in-app social feed — native share sheet only

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Auto-detect exercise from video | Pose estimation alone cannot reliably distinguish bodyweight movements (~60-70% accuracy). User must select exercise before recording. |
| In-app social feed | Social content moderation + feed ranking is a separate product. Dilutes focus from AI coaching. |
| Nutrition / meal planning | Regulated domain, doubles product surface, does not advance core value |
| Wearable integration | Adds third SDK surface; biometric data doesn't improve form analysis quality |
| Live video streaming / virtual trainer | WebRTC + server-side real-time AI inference is extreme infrastructure complexity |
| Full exercise catalog AI coverage (2500+) | Deep accuracy on 4 core moves beats shallow coverage on hundreds |
| Web app as primary surface | Mobile-first; Next.js app remains a placeholder |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| PROF-01 | Phase 2 | Complete |
| PROF-02 | Phase 2 | Complete |
| PROF-03 | Phase 2 | Complete |
| PROF-04 | Phase 2 | Complete |
| PROF-05 | Phase 2 | Complete |
| WKT-01 | Phase 3 | Pending |
| WKT-02 | Phase 3 | Pending |
| WKT-03 | Phase 3 | Pending |
| WKT-04 | Phase 3 | Pending |
| WKT-05 | Phase 4 | Pending |
| WKT-06 | Phase 4 | Pending |
| WKT-07 | Phase 4 | Pending |
| FORM-01 | Phase 5 | Pending |
| FORM-02 | Phase 5 | Pending |
| FORM-03 | Phase 5 | Pending |
| FORM-04 | Phase 5 | Pending |
| FORM-05 | Phase 5 | Pending |
| FORM-06 | Phase 5 | Pending |
| FORM-07 | Phase 5 | Pending |
| FORM-08 | Phase 5 | Pending |
| RT-01 | Phase 6 | Pending |
| RT-02 | Phase 6 | Pending |
| RT-03 | Phase 6 | Pending |
| RT-04 | Phase 6 | Pending |
| PROG-01 | Phase 7 | Pending |
| PROG-02 | Phase 7 | Pending |
| PROG-03 | Phase 7 | Pending |
| PROG-04 | Phase 7 | Pending |
| NOTF-01 | Phase 2 | Complete |
| NOTF-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after initial definition*
