# Form calibration report

## Run 1 (rubric-v0)

> Caveat: Run 1 was produced from the original fixtures, where every landscape clip (all push-up and dip clips) had been dumped upside-down because the 180 degree video rotation tag was ignored. Its dip trunk-lean values (142-163 deg) and the dip/diag45_1 3-rep result are artefacts of that. Run 2 uses re-dumped, upright fixtures.

Date: 2026-11-09 | METRICS_VERSION: metrics-v1 | RUBRIC_VERSION: rubric-v0

### Plain-language summary

- **push_up/diag45_1** (diag45 view, normal light): expected 5 reps; no score given (WRONG_VIEW). The coach would ask for a re-record.
- **push_up/side_1** (side view, normal light): expected 5 reps, found 5. Score 98, band EXCELLENT. Coach says: nothing to fix.
- **push_up/side_2** (side view, dim light): expected 5 reps, found 5. Score 97, band EXCELLENT. Coach says: nothing to fix.
- **push_up/hold_side** (side view, normal light): expected a hold, no reps; no score given (NO_REPS_DETECTED). The coach would ask for a re-record.
- **pull_up/back_1** (back view, normal light): expected 5 reps, found 5. Score 64, band FAIR. Coach says: "Pull with both arms equally and keep your shoulders level." (pulling unevenly, HIGH); "Lower yourself slowly instead of dropping." (rushed reps, LOW).
- **pull_up/front_1** (front view, normal light): expected 5 reps, found 5. Score 72, band FAIR. Coach says: "Pull with both arms equally and keep your shoulders level." (pulling unevenly, MEDIUM); "Lower yourself slowly instead of dropping." (rushed reps, LOW).
- **pull_up/side_1** (side view, normal light): expected 5 reps; no score given (WRONG_VIEW). The coach would ask for a re-record.
- **pull_up/hold_front** (side view, normal light): expected a hold, no reps; no score given (NO_REPS_DETECTED). The coach would ask for a re-record.
- **dip/diag45_1** (diag45 view, dim light): expected 5 reps, found 3. Score 55, band NEEDS_WORK. Coach says: "Keep your chest more upright as you lower." (leaning far forward, MEDIUM); "Press up until your arms are straight." (arms not fully straight at the top, MEDIUM).
- **dip/side_1** (side view, normal light): expected 5 reps, found 5. Score 53, band NEEDS_WORK. Coach says: "Keep your chest more upright as you lower." (leaning far forward, MEDIUM); "Press up until your arms are straight." (arms not fully straight at the top, MEDIUM).
- **dip/side_2** (side view, normal light): expected 5 reps, found 5. Score 55, band NEEDS_WORK. Coach says: "Keep your chest more upright as you lower." (leaning far forward, MEDIUM); "Press up until your arms are straight." (arms not fully straight at the top, MEDIUM).
- **dip/hold_side** (side view, normal light): expected a hold, no reps; no score given (NO_REPS_DETECTED). The coach would ask for a re-record.
- **squat/diag45_1** (diag45 view, normal light): expected 5 reps, found 5. Score 81, band GOOD. Coach says: "Sit down until your hips reach knee height." (shallow depth, HIGH).
- **squat/side_1** (side view, normal light): expected 5 reps, found 5. Score 90, band EXCELLENT. Coach says: "Sit down until your hips reach knee height." (shallow depth, MEDIUM).
- **squat/side_2** (side view, dim light): expected 5 reps, found 5. Score 87, band GOOD. Coach says: "Sit down until your hips reach knee height." (shallow depth, MEDIUM).
- **squat/hold_side** (side view, normal light): expected a hold, no reps; no score given (NO_REPS_DETECTED). The coach would ask for a re-record.

### Known findings from 05-14

- Every squat clip flags SQ_SHALLOW_DEPTH, which suggests the depth threshold is too strict for these takes (or the clips are genuinely shallow) and needs your judgement.
- Both side-on dip clips (dip/side_1, dip/side_2) score NEEDS_WORK; check whether those takes really looked that poor.
- dip/diag45_1 segments to 3 reps although 5 were performed, so the diagonal view likely confuses the rep counter.

### Table

| clip | view | light | expected reps | outcome | reps (dropped) | overall score | band | ROM | CORE | SYMMETRY | corrections | untrackable reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| push_up/diag45_1 | diag45 | normal | 5 | UNTRACKABLE | 0 | - | - | - | - | - | - | WRONG_VIEW |
| push_up/side_1 | side | normal | 5 | SCORED | 5 (0 dropped) | 98 | EXCELLENT | EXCELLENT | EXCELLENT | n/a | none | - |
| push_up/side_2 | side | dim | 5 | SCORED | 5 (0 dropped) | 97 | EXCELLENT | EXCELLENT | EXCELLENT | n/a | none | - |
| push_up/hold_side | side | normal | 0 | UNTRACKABLE | 0 | - | - | - | - | - | - | NO_REPS_DETECTED |
| pull_up/back_1 | back | normal | 5 | SCORED | 5 (0 dropped) | 64 | FAIR | EXCELLENT | NEEDS_WORK | POOR | PL_ASYM_PULL:HIGH, PL_RUSHED_TEMPO:LOW | - |
| pull_up/front_1 | front | normal | 5 | SCORED | 5 (0 dropped) | 72 | FAIR | EXCELLENT | NEEDS_WORK | NEEDS_WORK | PL_ASYM_PULL:MEDIUM, PL_RUSHED_TEMPO:LOW | - |
| pull_up/side_1 | side | normal | 5 | UNTRACKABLE | 0 | - | - | - | - | - | - | WRONG_VIEW |
| pull_up/hold_front | side | normal | 0 | UNTRACKABLE | 0 | - | - | - | - | - | - | NO_REPS_DETECTED |
| dip/diag45_1 | diag45 | dim | 5 | SCORED | 3 (0 dropped) | 55 | NEEDS_WORK | FAIR | NEEDS_WORK | n/a | DIP_EXCESSIVE_LEAN:MEDIUM, DIP_INCOMPLETE_LOCKOUT:MEDIUM | - |
| dip/side_1 | side | normal | 5 | SCORED | 5 (0 dropped) | 53 | NEEDS_WORK | FAIR | NEEDS_WORK | n/a | DIP_EXCESSIVE_LEAN:MEDIUM, DIP_INCOMPLETE_LOCKOUT:MEDIUM | - |
| dip/side_2 | side | normal | 5 | SCORED | 5 (0 dropped) | 55 | NEEDS_WORK | FAIR | NEEDS_WORK | n/a | DIP_EXCESSIVE_LEAN:MEDIUM, DIP_INCOMPLETE_LOCKOUT:MEDIUM | - |
| dip/hold_side | side | normal | 0 | UNTRACKABLE | 0 | - | - | - | - | - | - | NO_REPS_DETECTED |
| squat/diag45_1 | diag45 | normal | 5 | SCORED | 5 (0 dropped) | 81 | GOOD | FAIR | EXCELLENT | n/a | SQ_SHALLOW_DEPTH:HIGH | - |
| squat/side_1 | side | normal | 5 | SCORED | 5 (0 dropped) | 90 | EXCELLENT | GOOD | EXCELLENT | n/a | SQ_SHALLOW_DEPTH:MEDIUM | - |
| squat/side_2 | side | dim | 5 | SCORED | 5 (0 dropped) | 87 | GOOD | GOOD | EXCELLENT | n/a | SQ_SHALLOW_DEPTH:MEDIUM | - |
| squat/hold_side | side | normal | 0 | UNTRACKABLE | 0 | - | - | - | - | - | - | NO_REPS_DETECTED |

### Features appendix (median per rep)

- **push_up/diag45_1**: untrackable, no features
- **push_up/side_1**: durationSec=1.3, maxElbowDeg=167.5, meanHipOffset=-0.0, minElbowDeg=49.8
- **push_up/side_2**: durationSec=1.1, maxElbowDeg=167.2, meanHipOffset=-0.0, minElbowDeg=52.6
- **push_up/hold_side**: untrackable, no features
- **pull_up/back_1**: durationSec=1.1, hipSwayRatio=0.2, maxElbowDeg=173.4, maxShoulderTiltDeg=9.7, meanElbowDiffDeg=27.0, mouthBelowBar=-0.3
- **pull_up/front_1**: durationSec=1.1, hipSwayRatio=0.2, maxElbowDeg=175.1, maxShoulderTiltDeg=9.7, meanElbowDiffDeg=17.2, mouthBelowBar=-0.2
- **pull_up/side_1**: untrackable, no features
- **pull_up/hold_front**: untrackable, no features
- **dip/diag45_1**: durationSec=1.3, hipSwayRatio=0.1, maxElbowDeg=145.7, minElbowDeg=87.7, trunkLeanDeg=163.0
- **dip/side_1**: durationSec=1.2, hipSwayRatio=0.0, maxElbowDeg=145.7, minElbowDeg=76.8, trunkLeanDeg=142.4
- **dip/side_2**: durationSec=1.1, hipSwayRatio=0.0, maxElbowDeg=148.0, minElbowDeg=80.5, trunkLeanDeg=141.7
- **dip/hold_side**: untrackable, no features
- **squat/diag45_1**: durationSec=1.3, heelRiseDeg=5.3, hipBelowKnee=-0.2, maxKneeDeg=179.7, minKneeDeg=111.3, shinLeanDeg=17.6, trunkLeanDeg=13.9
- **squat/side_1**: durationSec=1.8, heelRiseDeg=0.5, hipBelowKnee=-0.1, maxKneeDeg=179.9, minKneeDeg=72.0, shinLeanDeg=24.5, trunkLeanDeg=35.5
- **squat/side_2**: durationSec=1.7, heelRiseDeg=5.5, hipBelowKnee=-0.1, maxKneeDeg=179.0, minKneeDeg=67.1, shinLeanDeg=31.8, trunkLeanDeg=32.7
- **squat/hold_side**: untrackable, no features

## User verdicts

Recorded verbatim from the user's review of Run 1.

- push_up side x2: form was clean. The engine's Excellent is correct. No change.
- push_up diag45 (landscape, 45 deg): the user says the filming was good. The engine says WRONG_VIEW. Rejecting non-side views for side-on exercises is the intended design (D-17), so it stays: intentional, shown with camera advice.
- pull_up back and front: the user pulled quickly, swung (body not rigid), and pulled slightly higher than needed. The rushed-tempo flag and the Fair band look right. The asymmetry flag is plausibly swing-induced, so it stays.
- pull_up side: the user filmed it side-on as instructed. The engine rejects it as WRONG_VIEW, because pull-ups need front or back. That is by design. Kept and documented; the camera advice for it was checked.
- dip side x2 and diag: the arms did not lock out, so the DIP_INCOMPLETE_LOCKOUT flag is CORRECT. The user leaned forward, but says the chest was not pushed out. The head was not visible for the whole video, so nose and mouth landmarks drop out. The diagonal clip has 5 reps, not 3, so the rep count of 3 is a real segmentation problem.
- squat side x2 and diag: the user agrees the depth was shallow, so SQ_SHALLOW_DEPTH is CORRECT. Flag thresholds are not changed.
- No bad takes were filmed; the re-dump step for bad takes was skipped.

## Run 2 (rubric-v1)

Date: 2026-11-10 | METRICS_VERSION: metrics-v1 | RUBRIC_VERSION: rubric-v1

### Plain-language summary

- **push_up/diag45_1** (diag45 view, normal light): expected 5 reps; no score given (WRONG_VIEW). The coach would ask for a re-record.
- **push_up/side_1** (side view, normal light): expected 5 reps, found 5. Score 99, band EXCELLENT. Coach says: nothing to fix.
- **push_up/side_2** (side view, dim light): expected 5 reps, found 5. Score 98, band EXCELLENT. Coach says: nothing to fix.
- **push_up/hold_side** (side view, normal light): expected a hold, no reps; no score given (NO_REPS_DETECTED). The coach would ask for a re-record.
- **pull_up/back_1** (back view, normal light): expected 5 reps, found 5. Score 64, band FAIR. Coach says: "Pull with both arms equally and keep your shoulders level." (pulling unevenly, HIGH); "Lower yourself slowly instead of dropping." (rushed reps, LOW).
- **pull_up/front_1** (front view, normal light): expected 5 reps, found 5. Score 72, band FAIR. Coach says: "Pull with both arms equally and keep your shoulders level." (pulling unevenly, MEDIUM); "Lower yourself slowly instead of dropping." (rushed reps, LOW).
- **pull_up/side_1** (side view, normal light): expected 5 reps; no score given (WRONG_VIEW). The coach would ask for a re-record.
- **pull_up/hold_front** (front view, normal light): expected a hold, no reps; no score given (NO_REPS_DETECTED). The coach would ask for a re-record.
- **dip/diag45_1** (diag45 view, dim light): expected 5 reps; no score given (NO_REPS_DETECTED). The coach would ask for a re-record.
- **dip/side_1** (side view, normal light): expected 5 reps, found 5. Score 76, band GOOD. Coach says: "Press up until your arms are straight." (arms not fully straight at the top, MEDIUM).
- **dip/side_2** (side view, normal light): expected 5 reps, found 5. Score 77, band GOOD. Coach says: "Press up until your arms are straight." (arms not fully straight at the top, MEDIUM).
- **dip/hold_side** (side view, normal light): expected a hold, no reps; no score given (NO_REPS_DETECTED). The coach would ask for a re-record.
- **squat/diag45_1** (diag45 view, normal light): expected 5 reps, found 5. Score 73, band FAIR. Coach says: "Sit down until your hips reach knee height." (shallow depth, HIGH).
- **squat/side_1** (side view, normal light): expected 5 reps, found 5. Score 80, band GOOD. Coach says: "Sit down until your hips reach knee height." (shallow depth, MEDIUM).
- **squat/side_2** (side view, dim light): expected 5 reps, found 5. Score 76, band GOOD. Coach says: "Sit down until your hips reach knee height." (shallow depth, MEDIUM).
- **squat/hold_side** (side view, normal light): expected a hold, no reps; no score given (NO_REPS_DETECTED). The coach would ask for a re-record.

### Table

| clip | view | light | expected reps | outcome | reps (dropped) | overall score | band | ROM | CORE | SYMMETRY | corrections | untrackable reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| push_up/diag45_1 | diag45 | normal | 5 | UNTRACKABLE | 0 | - | - | - | - | - | - | WRONG_VIEW |
| push_up/side_1 | side | normal | 5 | SCORED | 5 (0 dropped) | 99 | EXCELLENT | EXCELLENT | EXCELLENT | n/a | none | - |
| push_up/side_2 | side | dim | 5 | SCORED | 5 (0 dropped) | 98 | EXCELLENT | EXCELLENT | EXCELLENT | n/a | none | - |
| push_up/hold_side | side | normal | 0 | UNTRACKABLE | 0 | - | - | - | - | - | - | NO_REPS_DETECTED |
| pull_up/back_1 | back | normal | 5 | SCORED | 5 (0 dropped) | 64 | FAIR | EXCELLENT | NEEDS_WORK | POOR | PL_ASYM_PULL:HIGH, PL_RUSHED_TEMPO:LOW | - |
| pull_up/front_1 | front | normal | 5 | SCORED | 5 (0 dropped) | 72 | FAIR | EXCELLENT | NEEDS_WORK | NEEDS_WORK | PL_ASYM_PULL:MEDIUM, PL_RUSHED_TEMPO:LOW | - |
| pull_up/side_1 | side | normal | 5 | UNTRACKABLE | 0 | - | - | - | - | - | - | WRONG_VIEW |
| pull_up/hold_front | front | normal | 0 | UNTRACKABLE | 0 | - | - | - | - | - | - | NO_REPS_DETECTED |
| dip/diag45_1 | diag45 | dim | 5 | UNTRACKABLE | 0 | - | - | - | - | - | - | NO_REPS_DETECTED |
| dip/side_1 | side | normal | 5 | SCORED | 5 (0 dropped) | 76 | GOOD | FAIR | GOOD | n/a | DIP_INCOMPLETE_LOCKOUT:MEDIUM | - |
| dip/side_2 | side | normal | 5 | SCORED | 5 (0 dropped) | 77 | GOOD | FAIR | GOOD | n/a | DIP_INCOMPLETE_LOCKOUT:MEDIUM | - |
| dip/hold_side | side | normal | 0 | UNTRACKABLE | 0 | - | - | - | - | - | - | NO_REPS_DETECTED |
| squat/diag45_1 | diag45 | normal | 5 | SCORED | 5 (0 dropped) | 73 | FAIR | NEEDS_WORK | EXCELLENT | n/a | SQ_SHALLOW_DEPTH:HIGH | - |
| squat/side_1 | side | normal | 5 | SCORED | 5 (0 dropped) | 80 | GOOD | FAIR | EXCELLENT | n/a | SQ_SHALLOW_DEPTH:MEDIUM | - |
| squat/side_2 | side | dim | 5 | SCORED | 5 (0 dropped) | 76 | GOOD | NEEDS_WORK | EXCELLENT | n/a | SQ_SHALLOW_DEPTH:MEDIUM | - |
| squat/hold_side | side | normal | 0 | UNTRACKABLE | 0 | - | - | - | - | - | - | NO_REPS_DETECTED |

### Features appendix (median per rep)

- **push_up/diag45_1**: untrackable, no features
- **push_up/side_1**: durationSec=1.3, maxElbowDeg=167.9, meanHipOffset=0.0, minElbowDeg=49.2
- **push_up/side_2**: durationSec=1.2, maxElbowDeg=167.6, meanHipOffset=0.0, minElbowDeg=52.9
- **push_up/hold_side**: untrackable, no features
- **pull_up/back_1**: durationSec=1.1, hipSwayRatio=0.2, maxElbowDeg=173.4, maxShoulderTiltDeg=9.7, meanElbowDiffDeg=27.0, mouthBelowBar=-0.3
- **pull_up/front_1**: durationSec=1.1, hipSwayRatio=0.2, maxElbowDeg=175.1, maxShoulderTiltDeg=9.7, meanElbowDiffDeg=17.2, mouthBelowBar=-0.2
- **pull_up/side_1**: untrackable, no features
- **pull_up/hold_front**: untrackable, no features
- **dip/diag45_1**: untrackable, no features
- **dip/side_1**: durationSec=1.2, hipSwayRatio=0.0, maxElbowDeg=145.6, minElbowDeg=76.5, trunkLeanDeg=37.0
- **dip/side_2**: durationSec=1.1, hipSwayRatio=0.0, maxElbowDeg=152.2, minElbowDeg=81.8, trunkLeanDeg=38.1
- **dip/hold_side**: untrackable, no features
- **squat/diag45_1**: durationSec=1.3, heelRiseDeg=5.3, hipBelowKnee=-0.2, maxKneeDeg=179.7, minKneeDeg=111.3, shinLeanDeg=17.6, trunkLeanDeg=13.9
- **squat/side_1**: durationSec=1.8, heelRiseDeg=0.5, hipBelowKnee=-0.1, maxKneeDeg=179.9, minKneeDeg=72.0, shinLeanDeg=24.5, trunkLeanDeg=35.5
- **squat/side_2**: durationSec=1.7, heelRiseDeg=5.5, hipBelowKnee=-0.1, maxKneeDeg=179.0, minKneeDeg=67.1, shinLeanDeg=31.8, trunkLeanDeg=32.7
- **squat/hold_side**: untrackable, no features

## Calibration outcome (Run 1 to Run 2)

1. Dip trunk lean: not a rubric bug. The fixtures were upside-down (phone clips carry a 180 degree rotation tag that OpenCV did not apply), so shoulders sat below hips and the lean read 142-163 deg. Fixed in `scripts/pose-eval/evaluate.py`, the push-up and dip fixtures were re-dumped, and the real lean is 37-38 deg. That is under the 45 deg flag, so DIP_EXCESSIVE_LEAN no longer fires. CORE ramp (30..60) unchanged.
2. Dip max elbow: real, not an artefact. Near-side elbow and wrist visibility are 0.94-1.00, and medians are 145.6 and 152.2 deg against the 155 deg lockout threshold, matching the user's "arms did not lock out".
3. dip/diag45_1: now NO_REPS_DETECTED instead of a 3-rep score. The 5 reps are in the signal (about 90-140 deg), but the clip also contains a mount (about 0-70 deg) and a dismount (about 170 deg), so the p5-p95 amplitude is about 117 deg and the 30%/70% thresholds sit outside the real reps. A general fix (segment only the active window) is not small, so it is left; the golden test pins the result with a comment that the user counted 5.
4. Squat leniency: squat ROM ramp on hipBelowKnee changed from 0.0..-0.30 to 0.0..-0.15 (flag thresholds untouched). Scores: side_1 90 EXCELLENT -> 80 GOOD, side_2 87 GOOD -> 76 GOOD, diag45_1 81 GOOD -> 73 FAIR. A generic "Excellent requires no MEDIUM/HIGH ROM correction" rule is proposed in the SUMMARY but not applied.
5. Manifest label: pull_up/hold_front was labelled view "side" because the dump script only matched stems that start with "front". It is now "front".
