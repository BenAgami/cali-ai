---
status: calibrated
approved: 2026-11-09
rubric_version: rubric-v1
metrics_version: metrics-v1
phase: 05-ai-form-analysis-camera-post-set
---

# Phase 5 Rubrics (v1 calibrated)

Single source for plans 05-04, 05-06, 05-07, 05-09 and 05-14. All thresholds are provisional coaching-consensus values (confidence LOW-MEDIUM); plan 05-17 calibrates them against the Phase 1 clips.

## 1. Conventions

- BlazePose indices: 0 nose, 9/10 mouth, 11/12 shoulders, 13/14 elbows, 15/16 wrists, 23/24 hips, 25/26 knees, 27/28 ankles, 29/30 heels, 31/32 foot index.
- Coordinates are isotropic: x is multiplied by aspectRatio before any geometry.
- Angles are 2D at the middle joint.
- Torso = shoulder-to-hip distance; L = shoulder-to-ankle distance; thigh = hip-to-knee distance.
- Side-on exercises use the near side (the chain with higher mean visibility).
- `ramp(v, good, poor)` = 100 at good, 0 at poor, linear between, clamped. NaN means the feature is not available and is excluded from the mean.

## 2. Camera views and assessability (D-17, D-18)

| Exercise | View / orientation | ROM | CORE | SYMMETRY |
| -------- | ------------------ | --- | ---- | -------- |
| push_up | side / landscape | yes | yes | Not assessed from this angle |
| dip | side / landscape | yes | yes | Not assessed from this angle |
| squat | side / portrait | yes | yes | Not assessed from this angle |
| pull_up | front-or-back / portrait | yes | yes (low confidence: lateral sway + tempo only) | yes |

## 3. Rep segmentation (per exercise)

| Exercise | Primary signal | Rest level | Min amplitude |
| -------- | -------------- | ---------- | ------------- |
| push_up | elbow angle | high | 40 deg |
| dip | elbow angle | high | 40 deg |
| squat | knee angle (fallback when near-knee mean visibility < 0.6: `-hipY / thigh`) | high | 30 deg (fallback: 0.5 thigh) |
| pull_up | clearance `(barY - mouthY) / torso`, barY = median wrist y over the set | low | 0.5 torso |

- Hysteresis on the smoothed signal: amp = p95 - p5; upper = p5 + 0.7 amp; lower = p5 + 0.3 amp. A rep is rest -> past the far threshold -> back to rest.
- Keep reps with duration 0.8-15 s and >= 60% valid frames; others are dropped and counted.
- Minimum reps for a band: **2** (fewer -> UNTRACKABLE `NO_REPS_DETECTED`).

## 4. Per-exercise tags

Columns: tag | dimension | per-rep feature | MEDIUM when | HIGH when | label | cue.

### push_up

| Tag | Dim | Feature | MEDIUM | HIGH | Label | Cue |
| --- | --- | ------- | ------ | ---- | ----- | --- |
| PU_SHALLOW_DEPTH | ROM | minElbowDeg | > 100 | > 120 | Shallow depth | Lower until your chest is a fist away from the floor. |
| PU_INCOMPLETE_LOCKOUT | ROM | maxElbowDeg | < 155 | never | Arms not fully straight at the top | Press all the way up until your arms are straight. |
| PU_HIP_SAG | CORE | meanHipOffset (L units, + = below line) | > 0.06 | > 0.12 | Hips sagging | Squeeze your glutes and brace your abs to keep one straight line from head to heels. |
| PU_HIP_PIKE | CORE | -meanHipOffset | > 0.08 | never | Hips piking up | Lower your hips so your body forms one straight line. |
| PU_RUSHED_TEMPO | CORE | durationSec | LOW when < 1.0 | never | Rushed reps | Take about a second on the way down and control the push. |

### pull_up

| Tag | Dim | Feature | MEDIUM | HIGH | Label | Cue |
| --- | --- | ------- | ------ | ---- | ----- | --- |
| PL_CHIN_NOT_OVER_BAR | ROM | mouthBelowBar (torso units at rep peak, + = below bar) | > 0.03 | > 0.15 | Chin not clearing the bar | Pull until your chin passes over the bar. |
| PL_NO_FULL_HANG | ROM | maxElbowDeg (mean of both arms) | < 155 | never | Not lowering all the way | Lower until your arms are straight before the next rep. |
| PL_ASYM_PULL | SYMMETRY | meanElbowDiffDeg or maxShoulderTiltDeg | > 12 or > 8 | > 20 or > 14 | Pulling unevenly | Pull with both arms equally and keep your shoulders level. |
| PL_RUSHED_TEMPO | CORE | durationSec | LOW when < 1.2 | never | Rushed reps | Lower yourself slowly instead of dropping. |

### dip

| Tag | Dim | Feature | MEDIUM | HIGH | Label | Cue |
| --- | --- | ------- | ------ | ---- | ----- | --- |
| DIP_SHALLOW_DEPTH | ROM | minElbowDeg | > 110 | > 125 | Shallow depth | Lower until your upper arms are about parallel to the floor. |
| DIP_EXCESSIVE_DEPTH | ROM | minElbowDeg | LOW when < 70 (never higher) | never | Going very deep | Stop around upper arms parallel to the floor unless you've built up to deeper dips. |
| DIP_INCOMPLETE_LOCKOUT | ROM | maxElbowDeg | < 155 | never | Arms not fully straight at the top | Press up until your arms are straight. |
| DIP_EXCESSIVE_LEAN | CORE | trunkLeanDeg at bottom | > 45 | never | Leaning far forward | Keep your chest more upright as you lower. |
| DIP_SWING | CORE | hipSwayRatio (hip x range / torso) | > 0.25 | never | Swinging | Keep your legs still and move only up and down. |

### squat

| Tag | Dim | Feature | MEDIUM | HIGH | Label | Cue |
| --- | --- | ------- | ------ | ---- | ----- | --- |
| SQ_SHALLOW_DEPTH | ROM | hipBelowKnee (thigh units, + = hip below knee) or minKneeDeg | < -0.05 or > 110 | < -0.20 | Shallow depth | Sit down until your hips are level with your knees. |
| SQ_EXCESSIVE_TRUNK_LEAN | CORE | trunkLeanDeg - shinLeanDeg, trunkLeanDeg | > 25 or trunk > 60 | never | Leaning forward a lot | Keep your chest up and sit your hips straight down. |
| SQ_HEEL_RISE | CORE | heelRiseDeg vs first-1-s baseline | > 10 | never | Heels lifting | Keep your whole foot on the floor and push through your heels. |
| SQ_INCOMPLETE_STAND | ROM | maxKneeDeg | LOW when < 160 | never | Not standing all the way up | Stand tall at the top of every rep. |
| SQ_RUSHED_TEMPO | CORE | durationSec | LOW when < 1.0 | never | Bouncing through reps | Control the way down and pause briefly at the bottom. |

### Shared set-level tag

`FATIGUE_DROP` | ROM | MEDIUM | "Form faded in the last reps" | "End the set when you can't keep the same range, or rest a little longer." Only when reps >= 4; compares the last 2 reps to the first 2. Triggers:

- push_up / dip: mean minElbowDeg of last 2 minus first 2 > 15
- pull_up: mean mouthBelowBar of last 2 minus first 2 > 0.08
- squat: mean hipBelowKnee of first 2 minus last 2 > 0.10

## 5. Must never be mentioned (LLM forbidden topics)

- push_up: elbow flare, neck position, shoulder blades, hand placement.
- pull_up: kipping, body swing front-to-back, shoulder blades, grip width.
- dip: shoulder shrug, shoulder blades, bar width, injury.
- squat: knees caving in, lower-back rounding, foot angle, knees past toes.
- All exercises: injury, pain, medical terms, height, weight, body composition.

## 6. Scoring ramps (per rep -> dimension)

- push_up: ROM = mean(ramp(minElbowDeg, 90, 130), ramp(maxElbowDeg, 165, 140)); CORE = 0.85 x bodyLine + 0.15 x ramp(durationSec, 1.5, 0.6), where bodyLine = ramp(meanHipOffset, 0.03, 0.15) if offset >= 0 else ramp(-offset, 0.04, 0.16).
- dip: ROM = mean(ramp(minElbowDeg, 95, 130), ramp(maxElbowDeg, 165, 140)); CORE = 0.6 x ramp(trunkLeanDeg, 30, 60) + 0.4 x ramp(hipSwayRatio, 0.10, 0.35).
- squat: ROM = mean(ramp(hipBelowKnee, 0.0, -0.15), ramp(maxKneeDeg, 170, 150)); CORE = 0.7 x ramp(trunkLeanDeg - shinLeanDeg, 15, 40) + 0.3 x ramp(heelRiseDeg, 3, 15).
- pull_up: ROM = mean(ramp(mouthBelowBar, -0.05, 0.25), ramp(maxElbowDeg, 165, 140)); CORE = 0.7 x ramp(hipSwayRatio, 0.10, 0.40) + 0.3 x ramp(durationSec, 1.8, 0.8); SYMMETRY = mean(ramp(meanElbowDiffDeg, 5, 25), ramp(maxShoulderTiltDeg, 4, 15)).

Set dimension score = round(0.85 x mean(rep scores) + 0.15 x min(rep scores)).

Overall = weighted mean over assessed dimensions, renormalised:

| Exercise | ROM | CORE | SYMMETRY |
| -------- | --- | ---- | -------- |
| push_up / dip / squat | 0.5 | 0.5 | n/a |
| pull_up | 0.5 | 0.1 | 0.4 |

Planner proposal: RESEARCH used 0.4/0.4/0.2; pull-up CORE is lowered because it is low confidence from the front.

## 7. Bands (D-05, D-15, level-agnostic)

>= 90 Excellent, 75-89 Good, 60-74 Fair, 40-59 Needs work, < 40 Poor. Dimension chips use the same cutoffs. Score is rounded to an integer before banding.

## 8. Finding selection (server-side, deterministic, FORM-07)

- A rep tag is set-level detected when affected reps >= max(1, ceil(0.4 x repCount)); set severity = highest severity among affected reps.
- Weight: LOW 1, MEDIUM 2, HIGH 3. Rank = weight x affectedFraction; ties by dimension order ROM, CORE, SYMMETRY, then tag code.
- Keep at most 2 corrections, at most one per dimension unless only one dimension has detected tags.
- Positives (max 3, in this order, each with rep numbers):
  1. assessed dimension at Good or better;
  2. full lockout/stand on every rep;
  3. consistent depth (std of depth feature: push_up/dip minElbowDeg < 8 deg, squat hipBelowKnee < 0.05, pull_up mouthBelowBar < 0.05);
  4. steady tempo (no rushed tag and duration coefficient of variation < 0.25);
  5. always-last fallback "You finished N reps".

## 9. Trackability gate (FORM-09, D-12)

Over the exercise's key joints:

- TOO_FEW_FRAMES if frames < 15 or duration < 3 s
- LOW_CONFIDENCE if mean visibility < 0.5
- KEY_JOINTS_HIDDEN if key joints visible (>= 0.5) in < 70% of frames
- OUT_OF_FRAME if > 10% of key-joint coordinates fall outside [0, 1]
- TOO_FAR if median torso length < 0.12 of frame height
- WRONG_VIEW if (side exercises) median shoulder width / torso > 0.55 or (pull_up) < 0.25
- NO_REPS_DETECTED if fewer than 2 reps

Untrackable sets get no band, no LLM call, and the session still completes.

## 10. Live setup check before recording (D-03, D-04)

- Window = last 15 frames (about 1 s at 15 fps).
- Ready when key joints of the visible side have visibility >= 0.5 in >= 80% of frames, landmark bounding box within [0.02, 0.98] on both axes, and body long axis spans >= 40% of the frame, held continuously for 1 s.
- Countdown 8 s (inside D-03's 5-10 s); pauses with "Step back into frame" if the check fails during the countdown.
- Recording auto-stops at 175 s (capture cap 180 s).

## 11. Cost guard (Open Question 7)

- `FORM_ANALYSIS_DAILY_CAP` = 15 accepted captures per user per rolling 24 h; over the cap -> 429 `DAILY_ANALYSIS_LIMIT_REACHED`.
- `FORM_ANALYSIS_EXERCISE_WORKOUT_CAP` = 2 accepted captures per exercise per workout session; a third attempt for the same exercise in the same workout -> 429 `EXERCISE_ANALYSIS_LIMIT_REACHED`. Applies only to captures whose session is linked to a workout.
- Retries of the same failed capture (`retryAnalysis`) reuse the stored capture, create no new capture and count toward neither cap. Only accepted new captures (past the consent gate and both cap checks, stored and enqueued) count. A rejected (428/429) attempt stores nothing and so does not count.
- Check order at capture: consent (428), daily cap, then per-exercise-per-workout cap.
- LLM: primary model at effort `low`, max 1200 output tokens, one in-attempt repair.

## 12. Open items for the user

- [x] Approve/edit each of sections 3-11
- [ ] Confirm 2 minimum reps
- [x] Daily cap set to 15 and per-exercise-per-workout cap set to 2 (user edit)
- [ ] Confirm pull-up weights 0.5/0.1/0.4
- [ ] Confirm DIP_EXCESSIVE_DEPTH stays an advisory LOW tag

## Change log

- Approved 2026-11-09. Sections 3-11 approved as written except the cap edit below; section 10 and all other thresholds unchanged.
- 11 / daily cap: 30 -> 15 accepted captures per user per rolling 24 h.
- 11 / new cap: at most 2 accepted captures per exercise per workout session (error `EXERCISE_ANALYSIS_LIMIT_REACHED`).
- 11 / retries: unchanged, retries do not count toward either cap.
- 12 / checklist wording: daily cap 15 and per-exercise-per-workout cap 2.
- Front matter: `rubric_version` rubric-v0-draft -> rubric-v0 (at the user's request; plan text suggested keeping the draft marker until 05-17).
- Calibration 2026-11-10 (rubric-v0 -> rubric-v1): squat / ROM ramp hipBelowKnee: 0.0..-0.30 -> 0.0..-0.15 (calibration). Shallow side takes went 90/87 -> 80/76; the flag thresholds are unchanged.
- Front matter: `status` approved -> calibrated, `rubric_version` rubric-v0 -> rubric-v1 (calibration).
- All other thresholds, ramps and band cutoffs unchanged by calibration; push-up, dip and pull-up values confirmed against the user's verdicts (calibration).
