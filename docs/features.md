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

- Form band (5 levels) per set. A 0–100 score is stored with each result for trend charts and training, but is not shown per set
- At most 2 suggested corrections, after a positive observation
- Camera advice instead of feedback when the body cannot be tracked reliably
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
- AI-generated workout plans (roadmap Phase 4)
- Personalized training programs
- Skill progression tracking
- A trained in-house form model to replace the AI API score
- Leaderboard / Community
- Injury risk alerts
- Admin dashboards analyses
