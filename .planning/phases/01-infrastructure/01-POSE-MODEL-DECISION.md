# Pose model decision (plan 01-04, criterion 6, D-21)

**Date:** 2026-11-08
**Decision:** BlazePose Full (33 landmarks).

## Clips evaluated

All 16 shot-list clips: for each of push_up, pull_up, dip and squat, 3 rep clips and 1 hold clip, one person, 10 fps sampling. Nothing was skipped. The pull-up clips were reshot (Nov 3) after the first set was filmed badly; the numbers below are from the reshot set. All pull-up clips are in normal light, so pull-up low-light performance is untested. Push-up, dip and squat each include one dim-light take.

## Decision rule

For each exercise, a model PASSES if, across that exercise's key joints, detection rate (confidence >= 0.3) is >= 90% AND mean confidence is >= 0.5, measured both over all frames and over the hard-position hold clip. The lightest model that passes all four exercises wins (Lightning < Thunder < BlazePose). If none passes all four, the model with the most passes wins (ties go to the lighter one) and the failing exercises are a Phase 5 risk. MoveNet uses keypoint score; BlazePose uses landmark `visibility`.

Push-up and dip are filmed side-on, so each of those clips is scored on its near side only (the side with the higher mean confidence, chosen per clip). Without that rule BlazePose passes 2/4.

## Results

### push_up

| model | subset | detection rate | mean confidence | frames | result |
| ----- | ------ | -------------- | --------------- | ------ | ------ |
| movenet_lightning | all | 0.514 | 0.337 | 368 | FAIL |
| movenet_lightning | hold | 0.736 | 0.386 | 69 | FAIL |
| movenet_thunder | all | 0.656 | 0.412 | 368 | FAIL |
| movenet_thunder | hold | 0.626 | 0.364 | 69 | FAIL |
| blazepose_full | all | 1.000 | 0.979 | 368 | PASS |
| blazepose_full | hold | 1.000 | 0.988 | 69 | PASS |

### pull_up

| model | subset | detection rate | mean confidence | frames | result |
| ----- | ------ | -------------- | --------------- | ------ | ------ |
| movenet_lightning | all | 0.725 | 0.407 | 309 | FAIL |
| movenet_lightning | hold | 0.767 | 0.413 | 78 | FAIL |
| movenet_thunder | all | 0.745 | 0.419 | 309 | FAIL |
| movenet_thunder | hold | 0.791 | 0.443 | 78 | FAIL |
| blazepose_full | all | 1.000 | 0.934 | 309 | PASS |
| blazepose_full | hold | 1.000 | 0.984 | 78 | PASS |

### dip

| model | subset | detection rate | mean confidence | frames | result |
| ----- | ------ | -------------- | --------------- | ------ | ------ |
| movenet_lightning | all | 0.648 | 0.388 | 300 | FAIL |
| movenet_lightning | hold | 0.625 | 0.373 | 72 | FAIL |
| movenet_thunder | all | 0.602 | 0.387 | 300 | FAIL |
| movenet_thunder | hold | 0.736 | 0.429 | 72 | FAIL |
| blazepose_full | all | 0.963 | 0.948 | 300 | PASS |
| blazepose_full | hold | 1.000 | 0.986 | 72 | PASS |

### squat

| model | subset | detection rate | mean confidence | frames | result |
| ----- | ------ | -------------- | --------------- | ------ | ------ |
| movenet_lightning | all | 0.982 | 0.664 | 427 | PASS |
| movenet_lightning | hold | 0.981 | 0.684 | 78 | PASS |
| movenet_thunder | all | 0.989 | 0.700 | 427 | PASS |
| movenet_thunder | hold | 0.989 | 0.715 | 78 | PASS |
| blazepose_full | all | 0.997 | 0.898 | 427 | PASS |
| blazepose_full | hold | 0.981 | 0.882 | 78 | PASS |

### Weakest BlazePose joint per exercise

| exercise | subset | joint | mean confidence | detection rate |
| --- | --- | --- | --- | --- |
| push_up | all | ankle | 0.940 | 1.000 |
| push_up | hold | ankle | 0.971 | 1.000 |
| pull_up | all | l_elbow | 0.763 | 1.000 |
| pull_up | hold | r_elbow | 0.942 | 1.000 |
| dip | all | wrist | 0.933 | 0.963 |
| dip | hold | wrist | 0.960 | 1.000 |
| squat | all | l_knee | 0.753 | 0.974 |
| squat | hold | l_knee | 0.463 | 0.846 |

## Decision

BlazePose Full passes all four exercises (4/4). MoveNet Lightning and Thunder each pass only squat (1/4), failing push-up, pull-up and dip on both detection rate and confidence. No lighter model meets the rule, so BlazePose wins.

## Consequences

- **Payload:** 33 keypoints per frame instead of 17. The capture schema already accepts 17 to 33 (`CAPTURE_LIMITS` in `packages/common`), so no schema change is needed, but the size caps and the ~25-60 KB estimate in criterion 1 should be rechecked with 33 points.
- **No official fast-tflite recipe.** BlazePose is a two-stage detector plus landmark pipeline, and `react-native-fast-tflite` has no ready-made integration for it. Wiring it into a vision-camera frame processor is the main on-device integration risk for Phase 5. The dev-build gate (01-03) only proved MoveNet Lightning.
- **Model asset:** `apps/native/assets/models/pose_landmarker_full.task` is the BlazePose Full bundle used for the evaluation. The bundled MoveNet Lightning file stays until Phase 5 replaces it.
- **Push-up and dip need a side-on camera.** They are scored on the near side only, so metrics come from the near side and left/right asymmetry cannot be judged from that view.
- **Provisional:** one person and 3 clips plus a hold per exercise. Margins are thin in places: squat hold has an l_knee mean confidence of 0.463 and detection of 0.846 (the pass is on the key-joint aggregate), and the dip at 45° clip is the weakest dip take. Recheck on the device camera in Phase 5.
- **Untested:** low light for pull-up (no dim take).
