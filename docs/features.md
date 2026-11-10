# CaliAI – Feature Specification

This document describes the functional capabilities of the system.

---

# 1. Core Feature – AI Form Analysis

The primary feature of CaliAI.

## 1.1 Live Capture

- User films a set with the camera inside the app. The phone extracts body
  keypoints while filming; the video is not saved or uploaded.
- Importing a video from the gallery is not supported in the MVP.
- Supported exercises (MVP):
  - Push-ups
  - Pull-ups
  - Dips
  - Squats
- Advanced skills and static holds (front lever, planche, plank and others)
  are added later as researched exercise definitions.

### Record offer and setup check

- On a push-up, pull-up, dip or squat, the workout screen offers "Record this
  set". Declining logs the set normally; the camera opens only on accept.
- Before the first recording the user accepts an AI notice (profile data and
  pose measurements go to the LLM provider).
- A setup check with a framing guide shows whether the whole body is in frame,
  the light is enough and the camera angle suits the exercise (side-on for
  push-up, dip and squat; facing the camera for pull-up). There is no Start
  button: when placement is good, a large 5 second countdown appears in the
  middle of the screen and recording starts by itself. If the user leaves the
  frame the countdown cancels and starts again once placement is good.
- Stop ends the set and submits the keypoints automatically. If the upload
  fails, "Retry upload" resends without re-recording. Recording auto-stops at
  175 s.

## 1.2 AI Analysis

Keypoints are turned into per-rep metrics, and an AI model evaluates them.
The system analyzes:

- Body posture
- Joint alignment
- Range of motion
- Stability
- Symmetry

## 1.3 Feedback Report

After analysis, the user receives:

- Form band (5 levels) per set, on a result screen with three dimension rows
  (symmetry reads "Not assessed from this angle" when filmed side-on). A 0–100 score is stored with each result for trend charts and training, but is not shown per set
- At most 2 suggested corrections, after a positive observation
- Camera advice instead of feedback when the body cannot be tracked reliably,
  with a "Record again" action
- Feedback that cites specific reps and puts positives first
- While a set is analysing, the workout shows an "Analysing" row and the rest
  timer keeps running; when the result is ready an in-app banner ("Feedback
  ready", with View feedback) appears on any screen, and the set shows a New
  badge. A failed analysis shows Retry.
- A "Recorded sets" section in the workout lists each recorded set with its
  band and status
- Visual indicators (future enhancement)
- Historical comparison

## 1.4 Training Data (opt-in)

- Users are asked for permission to keep their anonymized pose data to
  improve the product.
- Without permission, only the result is kept.
- Users can withdraw consent at any time.

---

# 2. User Management

## 2.1 Authentication

- Register
- Login
- JWT-based session

## 2.2 Profile

- Basic user information
- Experience level
- Goals
- Profile authenticated and authorized

---

# 3. Workout Sessions

## 3.1 Create Session

User can:

- Select exercise
- Film the set for analysis
- Add notes

## 3.2 Session History

User can:

- View past sessions
- Compare performance
- Track improvement trends

---

# 4. Progress Tracking

- Exercise-specific performance history
- Average form score over time (smoothed over several sets)
- Milestone tracking

---

# 5. Future Features (Planned)

- Real-time feedback mode (deferred; not in v1)
- AI-generated workout plans: implemented in Phase 4 (goal text + profile in, catalog-only plan out, with disclaimer and consent)
- Personalized training programs
- Skill progression tracking
- A trained in-house form model to replace the AI API score
- Leaderboard / Community
- Injury risk alerts
- Admin dashboards analyses
