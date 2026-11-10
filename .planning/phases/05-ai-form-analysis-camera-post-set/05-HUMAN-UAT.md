---
status: pending
phase: 05-ai-form-analysis-camera-post-set
source: [05-VALIDATION.md, ROADMAP.md Phase 5 success criteria]
started:
updated:
---

## Current Test

[awaiting device UAT on Android]

## Setup

- Android dev build installed; API running locally (`yarn workspace api dev`) with a real `ANTHROPIC_API_KEY` in `apps/api/.env`; Metro running (`yarn workspace native dev`).
- A workout containing push-ups (and ideally pull-ups, dips, squats) exists.
- Fill in the Result column with PASS / FAIL / SKIPPED and add notes.

## Tests

| ID  | Criterion / Check                    | Steps                                                                                                               | Expected                                                                                                                                                | Result | Notes |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| 1   | Criterion 1: record offer            | Open a workout with a push-up, pull-up, dip and squat; Start; look at each exercise. Open a non-supported exercise. | "Record this set" shows only on push-up, pull-up, dip, squat. Declining and logging the set works normally. Camera opens only after accepting.          |        |       |
| 1b  | Criterion 1: auto-submit on Stop     | Accept the offer, record 5 push-ups, tap Stop.                                                                      | Keypoints submit automatically (no manual upload step); you return to the workout.                                                                      |        |       |
| 2   | Criterion 2: band and dimensions     | Open the result of a push-up set filmed side-on.                                                                    | A band (5 levels) and 3 dimension chips; Symmetry reads "Not assessed from this angle"; no 0-100 number anywhere.                                       |        |       |
| 3   | Criterion 3: feedback text           | Read the feedback on the result.                                                                                    | Cites specific reps; positives first; at most 2 corrections.                                                                                            |        |       |
| 4   | Criterion 4: banner and deep link    | After Stop, navigate to another tab and wait.                                                                       | "Feedback ready" banner appears without manual refresh; View feedback opens the result; the set shows a New badge.                                      |        |       |
| 5a  | Criterion 5: forced failure          | Force a failed analysis (stop the worker or set an invalid LLM key), then tap Retry.                                | Failed row shows Retry; Retry re-runs the analysis from the stored capture and completes once the cause is fixed.                                       |        |       |
| 5b  | Criterion 5: airplane mode at Stop   | Record a set, turn on airplane mode, tap Stop, then turn it off and tap Retry upload.                               | "Retry upload" is shown; tapping it resends without re-recording.                                                                                       |        |       |
| 6   | Criterion 6: untrackable             | Record with the phone placed so the body is mostly out of view or covered.                                          | Camera advice (tips) instead of feedback, with a "Record again" action that reopens the camera.                                                         |        |       |
| 7   | PROF-07: consent re-prompt           | Use an account that accepted the old notice (or reset consent); tap Record this set.                                | The new AI notice wording (profile data and pose measurements sent to the AI provider) is shown and must be accepted before the camera.                |        |       |
| 8   | Permission denied                    | Deny the camera permission when asked.                                                                              | A clear message and a way to open settings or go back; nothing crashes; the set can still be logged normally.                                           |        |       |
| 9   | Dark room: push-up                   | Record a push-up set in a dim room.                                                                                 | Setup check flags the light (too dark / step back message) or the set analyses; an untrackable result gives advice. Note what actually happens.        |        |       |
| 10  | Dark room: pull-up (Phase 1 gap)     | Record a pull-up set in a dim room. First real test: C6 was skipped in the pose spike.                              | Same as above; note detection quality and whether advice is shown.                                                                                      |        |       |
| 11  | Pull-up facing the camera            | Record pull-ups facing the camera, portrait. First real test: C5 was skipped in the pose spike.                     | Setup check does not demand a side view; body tracks; a result or advice is returned.                                                                   |        |       |
| 12  | Out-of-frame message                 | In the setup check, step partly out of frame at each edge.                                                          | The matching message appears (move left/right, step back); Start stays disabled until framed.                                                           |        |       |
| 13  | Countdown pause                      | Start the countdown, then step out of frame.                                                                        | Countdown pauses with "Step back into frame" and resumes when you return.                                                                               |        |       |
| 14  | 175 s auto-stop upload               | Start recording and let it run to the limit without tapping Stop.                                                   | Recording auto-stops around 175 s and the capture uploads automatically.                                                                                |        |       |
| 15  | Backgrounded during analysis         | Stop a set, immediately background the app, reopen after the analysis should be done.                               | The result is there; the New badge is restored on the set.                                                                                              |        |       |
| 16  | Landscape lock: push-up/dip          | Open the recorder for push-up and for dip.                                                                          | Screen locks to landscape for these exercises; squat and pull-up stay portrait.                                                                         |        |       |
| 17  | Landscape held in BOTH directions    | Record a push-up in landscape rotated left, then again rotated right (180 degrees the other way).                   | Overlay dots align with the body in both; results are comparable. The opposite-landscape handling from 05-13 is inferred and has never run on a device. |        |       |
| 18  | Portrait                             | Record a squat in portrait.                                                                                         | Dots align with the body (rotation per camera); squat was marginal (88%) in the spike, so note tracking quality.                                        |        |       |
| 19  | Front and back camera                | Repeat a short recording with the front and then the back camera.                                                   | Left/right labels are correct on both; the front preview overlay is mirrored consistently with the preview; the result is plausible on both.           |        |       |
| 20  | RTL (Hebrew) phone                   | Switch the phone to Hebrew (RTL) and open the recorder.                                                             | Overlay dots and the framing guide are not mirrored (they stay left-to-right and line up with the body).                                                |        |       |

## Notes from the pose spike

- C5 (pull-up facing the camera) and C6 (pull-up in dim light) were skipped in the spike, so rows 10 and 11 are the first real tests of those cases.
- The opposite-landscape (180 degree) handling added in 05-13 is inferred from the sensor geometry, never tested on a device (row 17).
- iOS runtime remains an accepted, untested risk (no Mac or Apple developer account).

## Summary

total: 22
passed: 0
issues: 0
pending: 22
skipped: 0
blocked: 0

## Gaps
