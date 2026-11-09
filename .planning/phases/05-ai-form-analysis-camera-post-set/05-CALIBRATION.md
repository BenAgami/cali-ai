# Form calibration report

## Run 1 (rubric-v0)

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
