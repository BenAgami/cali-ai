---
status: complete
phase: 05-ai-form-analysis-camera-post-set
source: [05-VALIDATION.md, ROADMAP.md Phase 5 success criteria]
started: 2026-11-10
updated: 2026-11-12
---

## Current Test

All 23 rows passed on a Galaxy S25+ (2026-11-10 and 2026-11-11).

## Setup

- Android dev build installed; API running locally (`yarn workspace api dev`) with a real `ANTHROPIC_API_KEY` in `apps/api/.env`; Metro running (`yarn workspace native dev`).
- A workout containing push-ups (and ideally pull-ups, dips, squats) exists.
- Fill in the Result column with PASS / FAIL / SKIPPED and add notes.

## Tests

| ID  | Criterion / Check                    | Steps                                                                                                               | Expected                                                                                                                                                | Result | Notes |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| 1   | Criterion 1: record offer            | Open a workout with a push-up, pull-up, dip and squat; Start; look at each exercise. Open a non-supported exercise. | "Record this set" shows only on push-up, pull-up, dip, squat. Declining and logging the set works normally. Camera opens only after accepting.          | PASS   |       |
| 1b  | Criterion 1: hands-free start, auto-submit | Accept the offer, step into frame (no button to press), let the 5 s countdown run, record 5 push-ups, tap Stop. | Keypoints submit automatically (no manual upload step); you return to the workout.                                                                      | PASS   |       |
| 2   | Criterion 2: band and dimensions     | Open the result of a push-up set filmed side-on.                                                                    | A band (5 levels) and 3 dimension chips; Symmetry reads "Not assessed from this angle"; no 0-100 number anywhere.                                       | PASS   |       |
| 3   | Criterion 3: feedback text           | Read the feedback on the result.                                                                                    | Cites specific reps; positives first; at most 2 corrections.                                                                                            | PASS   |       |
| 4   | Criterion 4: banner and deep link    | After Stop, navigate to another tab and wait.                                                                       | "Feedback ready" banner appears without manual refresh; View feedback opens the result; the set shows a New badge.                                      | PASS   |       |
| 5a  | Criterion 5: forced failure          | Force a failed analysis (stop the worker or set an invalid LLM key), then tap Retry.                                | Failed row shows Retry; Retry re-runs the analysis from the stored capture and completes once the cause is fixed.                                       | PASS   |       |
| 5b  | Criterion 5: airplane mode at Stop   | Record a set, turn on airplane mode, tap Stop, then turn it off and tap Retry upload.                               | "Retry upload" is shown; tapping it resends without re-recording.                                                                                       | PASS   |       |
| 6   | Criterion 6: untrackable             | Record with the phone placed so the body is mostly out of view or covered.                                          | Camera advice (tips) instead of feedback, with a "Record again" action that reopens the camera.                                                         | PASS   |       |
| 7   | PROF-07: consent re-prompt           | Use an account that accepted the old notice (or reset consent); tap Record this set.                                | The new AI notice wording (profile data and pose measurements sent to the AI provider) is shown and must be accepted before the camera.                | PASS   |       |
| 8   | Permission denied                    | Deny the camera permission when asked.                                                                              | A clear message and a way to open settings or go back; nothing crashes; the set can still be logged normally.                                           | PASS   ||
| 9   | Dark room: push-up                   | Record a push-up set in a dim room.                                                                                 | Setup check flags the light (too dark / step back message) or the set analyses; an untrackable result gives advice. Note what actually happens.        | PASS   | Dim room (some light, not dark): body tracked and the set analysed. No live light warning appears because the pose plugin gives no brightness value (TOO_DARK cannot fire live); a truly dark room would show the not-detected message. |
| 10  | Dark room: pull-up (Phase 1 gap)     | Record a pull-up set in a dim room. First real test: C6 was skipped in the pose spike.                              | Same as above; note detection quality and whether advice is shown.                                                                                      | PASS | Same as row 9: dim room, body tracked, set analysed; no live light warning (known limit). |
| 11  | Pull-up facing the camera            | Record pull-ups facing the camera, portrait. First real test: C5 was skipped in the pose spike.                     | Setup check does not demand a side view; body tracks; a result or advice is returned.                                                                   | PASS | |
| 12  | Out-of-frame message                 | In the setup check, step partly out of frame at each edge.                                                          | The matching message appears (move left/right, step back); no countdown starts until framed.                                                                   | PASS   | Re-tested after the fix (edge named from the hidden joints, or from the last detected position when the pose model emits no frames); left/right messages correct on the front camera. |
| 13  | Countdown cancels when you leave     | Let the 5 s countdown start, then step out of frame.                                                                | Countdown disappears and the message returns; it restarts at 5 once you are framed again.                                                                               | PASS | |
| 14  | 175 s auto-stop upload               | Start recording and let it run to the limit without tapping Stop.                                                   | Recording auto-stops around 175 s and the capture uploads automatically.                                                                                | PASS | |
| 15  | Backgrounded during analysis         | Record a real set (about 5 reps), tap Stop, immediately background the app, reopen after the analysis should be done. | The completed result (a band) is there; the New badge is restored on the set.                                                                           | PASS   |       |
| 16  | Landscape lock: push-up/dip          | Open the recorder for push-up and for dip.                                                                          | Screen locks to landscape for these exercises; squat and pull-up stay portrait.                                                                         | PASS | |
| 17  | Landscape held in BOTH directions    | Record a push-up in landscape rotated left, then again rotated right (180 degrees the other way). Wait for both results. | The preview is upright in both directions and both sets analyse (a band, not "Couldn't track you" or a wrong-angle warning) with similar bands. The recorder draws no dots: the 05-13 opposite-landscape handling changes the pose data, so only the results show it works. It has never run on a device. | PASS   |       |
| 18  | Portrait                             | Record a squat in portrait. | The preview is upright, the setup check reaches the countdown and the result is plausible. Squat was marginal (88%) in the spike, so note tracking quality. The recorder draws no dots; the dev screen (Settings, Developer, BlazePose check, Portrait) shows them. | PASS   | Re-tested after the cue rewording: the squat set analysed and returned a result. |
| 19  | Front and back camera                | Record a short set with the front camera, then with the back camera (camera-switch button). On the back camera you cannot see the screen: listen for the spoken cues. | The preview is upright on both cameras and the result is plausible on both. On the back camera you hear the placement advice (e.g. "Move left"), the countdown, "Go" and "Recording stopped". Needs a rebuilt dev build (expo-speech). | PASS   | Front and back camera both tested; on the back camera the spoken cues (placement advice, countdown, Go, Recording stopped) are heard. |
| 20  | RTL (Hebrew) phone                   | Switch the phone to Hebrew (RTL) and open the recorder. | The framing guide, hint text and buttons are laid out correctly and not mirrored; the "Move left/right" messages still point the right way. | PASS   | Re-tested after the fix: move left/right named on the RTL phone. |
| 21  | Auto-stop | Record a set of 5 reps with 2-3 s pauses between some reps (it must not stop during these), then walk out of the frame and sit down; do not touch the phone. | Recording stops by itself about 5 s after you leave and uploads; the result scores your reps (a band, not "Couldn't track you"). | PASS   | Re-tested after the fix: recording stops about 5 s after leaving the frame, with a spoken 3-2-1 first; the result scores the reps; mid-set pauses do not stop it. |

## Notes from the pose spike

- C5 (pull-up facing the camera) and C6 (pull-up in dim light) were skipped in the spike, so rows 10 and 11 are the first real tests of those cases.
- The opposite-landscape (180 degree) handling added in 05-13 is inferred from the sensor geometry, never tested on a device (row 17).
- iOS runtime remains an accepted, untested risk (no Mac or Apple developer account).

## Summary

total: 23
passed: 23
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None open. Issues found during the run and fixed in code, then re-tested:

- Row 12 / 20: no left/right message when stepping out of frame (the pose model emits no frames once too little of the body is in view, and the clipped joints were never read).
- Row 18: squat analysis failed because the cue text contained the forbidden topic "height" (squat and push-up cues reworded).
- Row 21: auto-stop never fired for the same no-frames reason; the timer now uses the clock and counts the last 3 s aloud.
- Row 19: the back camera hides the screen, so the recorder now speaks its guidance.
