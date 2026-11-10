---
status: pending
phase: 05-ai-form-analysis-camera-post-set
source: [05-VALIDATION.md, ROADMAP.md Phase 5 success criteria]
started: 2026-11-10
updated: 2026-11-10
---

## Current Test

Rows 1-11, 13, 14 and 16 passed (user, 2026-11-10); row 12 fixed and awaiting re-test; rows 15, 17-22 pending (21-22 added for auto-stop).

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
| 12  | Out-of-frame message                 | In the setup check, step partly out of frame at each edge.                                                          | The matching message appears (move left/right, step back); no countdown starts until framed.                                                                   | ISSUE | Only the generic step-back message appeared, never move left/right; the countdown correctly did not start. Cause: out-of-frame joints fail the visibility check first, so the edge was never named. Fixed (edge inferred from hidden joints at the frame boundary; left/right swapped on the mirrored front preview); needs a re-test. |
| 13  | Countdown cancels when you leave     | Let the 5 s countdown start, then step out of frame.                                                                | Countdown disappears and the message returns; it restarts at 5 once you are framed again.                                                                               | PASS | |
| 14  | 175 s auto-stop upload               | Start recording and let it run to the limit without tapping Stop.                                                   | Recording auto-stops around 175 s and the capture uploads automatically.                                                                                | PASS | |
| 15  | Backgrounded during analysis         | Stop a set, immediately background the app, reopen after the analysis should be done.                               | The result is there; the New badge is restored on the set.                                                                                              |        |       |
| 16  | Landscape lock: push-up/dip          | Open the recorder for push-up and for dip.                                                                          | Screen locks to landscape for these exercises; squat and pull-up stay portrait.                                                                         | PASS | |
| 17  | Landscape held in BOTH directions    | Record a push-up in landscape rotated left, then again rotated right (180 degrees the other way). Wait for both results. | The preview is upright in both directions and both sets analyse (a band, not "Couldn't track you" or a wrong-angle warning) with similar bands. The recorder draws no dots: the 05-13 opposite-landscape handling changes the pose data, so only the results show it works. It has never run on a device. |        |       |
| 18  | Portrait                             | Record a squat in portrait. | The preview is upright, the setup check reaches the countdown and the result is plausible. Squat was marginal (88%) in the spike, so note tracking quality. The recorder draws no dots; the dev screen (Settings, Developer, BlazePose check, Portrait) shows them. |        |       |
| 19  | Front and back camera                | Repeat a short recording with the front and then the back camera. | The preview is upright on both cameras and the result is plausible on both. Left/right labels and mirrored dots are only visible in the dev screen (BlazePose check). |        |       |
| 20  | RTL (Hebrew) phone                   | Switch the phone to Hebrew (RTL) and open the recorder. | The framing guide, hint text and buttons are laid out correctly and not mirrored; the "Move left/right" messages still point the right way. |        |       |
| 21  | Auto-stop: walk away | Record a set of 5 reps, then walk out of the frame and sit down; do not touch the phone. | Recording stops by itself about 5 s after you leave and uploads; the result scores your reps (a band, not "Couldn't track you"). Also check row 15 again. | | |
| 22  | Auto-stop: stand still | Record a set, then stand still in frame for about 6 s after the last rep. Also pause 2-3 s between reps mid-set. | It stops about 6 s after you finish and not during the 2-3 s pauses; the result scores your reps. | | |

## Notes from the pose spike

- C5 (pull-up facing the camera) and C6 (pull-up in dim light) were skipped in the spike, so rows 10 and 11 are the first real tests of those cases.
- The opposite-landscape (180 degree) handling added in 05-13 is inferred from the sensor geometry, never tested on a device (row 17).
- iOS runtime remains an accepted, untested risk (no Mac or Apple developer account).

## Summary

total: 24
passed: 16
issues: 1
pending: 7
skipped: 0
blocked: 0

## Gaps

- Row 12: the out-of-frame message never named an edge on device. Fixed in code; re-test on device.
- Row 15: tested only with a zero-rep set (correct "Couldn't track you" result restored after backgrounding); re-test with real reps to check the completed result and New badge.
