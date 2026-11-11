---
phase: 05-ai-form-analysis-camera-post-set
plan: 18
subsystem: verification
tags: [uat, device, docs, gates]
requires:
  - phase: 05-17
    provides: calibrated rubric-v1
provides:
  - CI gates green for the whole phase
  - Phase 5 docs (features, architecture, CLAUDE.md form metrics rules)
  - 05-HUMAN-UAT.md: 23 device rows, all passed on a Galaxy S25+
affects: [phase-05 verification]
key-files:
  created:
    - apps/native/src/hooks/useSpokenCues.ts
    - packages/common/src/validations/formSetEnd.ts
    - apps/api/tests/unit/common/formSetEnd.test.ts
    - apps/api/tests/unit/metrics/rubrics/forbiddenTopics.test.ts
    - patches/react-native-mediapipe-posedetection+0.4.0.patch
  modified:
    - apps/native/src/hooks/useRecordedSet.ts
    - apps/native/app/(main)/record-set.tsx
    - packages/common/src/validations/formSetup.ts
    - apps/api/src/metrics/rubrics/squat.ts
    - apps/api/src/metrics/rubrics/pushUp.ts
    - docs/features.md
    - docs/architecture.md
key-decisions:
  - "D-22: hands-free start (no Start button; 5 s countdown after 5 s of good placement)"
  - "D-23: the set ends by itself (5 s out of frame or 6 s still), idle tail trimmed, last 3 s counted aloud"
  - "Spoken cues (expo-speech) so the back camera works while the screen faces away"
requirements-completed: [FORM-02, NOTF-02]
completed: 2026-11-12
---

# Phase 5 Plan 18: Gates, docs and device UAT Summary

Gates, docs and the Android device UAT for Phase 5. All 23 UAT rows passed on a Galaxy S25+ (Hebrew/RTL), covering the six roadmap success criteria.

## What was done

1. **Gates and docs (Task 1):** type-check, lint, Knip, Prettier, syncpack and the unit and integration suites green; features, architecture and CLAUDE.md updated for the form analysis pipeline.
2. **Device UAT (Task 2):** run with the user over two days. Rows 1-11, 13, 14, 16, 15 and 17 passed as built; the rest needed fixes found on the device (below), then passed on re-test.
3. **Results recorded (Task 3):** `05-HUMAN-UAT.md` holds every result with notes; no gaps remain open.

## Deviations found on the device and fixed

- **Camera preview rotation** in landscape (portrait-first mount, lock the screen on `onPreviewStarted`, texture view, `outputOrientation="preview"`, cover until the window is rotated).
- **Hands-free start (D-22):** the Start button was replaced by a countdown that begins after 5 s of good placement and cancels if placement is lost.
- **Noisy `onResults` log:** patched out of the library with patch-package.
- **Out-of-frame message (rows 12, 20):** the pose model emits no frames when too little of the body is in view, so the edge is now taken from the last detected position (`exitEdgeOf`) as well as from clamped hidden joints.
- **Auto-stop (D-23, row 21):** `evaluateSetEnd` ends the set after 5 s out of frame or 6 s still, trims the idle tail, and measures from the clock because frames stop when nobody is detected.
- **Squat analysis failure (row 18):** the cue "Sit down until your hips reach knee height" contained the forbidden topic "height", so feedback validation rejected the model's own text. Squat and push-up cues were reworded and a test guards every rubric label and cue.
- **Spoken cues (row 19):** with the back camera the screen faces away, so placement advice, the countdown, "Go", a 3-2-1 before an automatic stop and "Recording stopped" are spoken (expo-speech, needs a native rebuild).

## Accepted risks and open items

- **iOS:** the pose runtime was never run on iOS (no Mac or Apple developer account); accepted.
- **Live light check:** the pose plugin gives no brightness value, so "too dark" never fires live; a dark room shows the not-detected message instead.
- **dip/diag45_1:** segmentation returns no reps on the calibration clip; pinned by a test, deferred.
- **Rubric:** the generic "Excellent requires no MEDIUM/HIGH ROM correction" rule was proposed, not applied.

## Verification

- `yarn check-types`, `yarn lint`, `yarn knip`, `yarn format:check`, `yarn deps:lint` pass; API unit tests 818/818.
- Device UAT: 23/23 passed (`05-HUMAN-UAT.md`).
