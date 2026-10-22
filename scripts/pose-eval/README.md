# Pose model evaluation

Offline comparison of MoveNet Lightning, MoveNet Thunder and BlazePose (33
points) on real clips of the four core exercises. Decides which skeleton the
phone produces (Phase 1 criterion 6).

## Setup

```
py -3.10 -m venv scripts/pose-eval/.venv
scripts/pose-eval/.venv/Scripts/python -m pip install -r scripts/pose-eval/requirements.txt
scripts/pose-eval/.venv/Scripts/python scripts/pose-eval/download_models.py
scripts/pose-eval/.venv/Scripts/python scripts/pose-eval/evaluate.py --self-test
```

## Run

```
scripts/pose-eval/.venv/Scripts/python scripts/pose-eval/evaluate.py --clips scripts/pose-eval/clips --fps 10 --out scripts/pose-eval/results
```

Clips and models are gitignored (personal footage, binaries). Results are
committed.

## Decision rule

For each exercise, a model PASSES if, across that exercise's key joints,
detection rate (confidence >= 0.3) is >= 90% AND mean confidence is >= 0.5,
measured both over all frames and over the hard-position hold clip. The
lightest model that passes all four exercises wins (Lightning < Thunder <
BlazePose). If none passes all four, the model with the most passes wins (ties
go to the lighter one) and the failing exercises are a Phase 5 risk. MoveNet
uses keypoint score; BlazePose uses landmark `visibility`.

## Shot list

Film on a phone propped at hip height, 1080p, 30 fps, landscape for
push_up/dip, portrait for pull_up/squat. Wear plain clothing that contrasts
the background. Whole body in frame for every clip (feet to hands at full
extension). Name files exactly as below and place them in
`clips/<exercise>/`.

| Exercise | Clips (5 reps each)                                               | Hold clip (5 s)                                           |
| -------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| push_up  | side_1 (normal light), side_2 (dim), diag45_1 (45 deg front-side) | hold_side.mp4 at the bottom (chest ~2 cm off the floor)   |
| pull_up  | front_1 (normal), back_1, side_1 (dim)                            | hold_front.mp4 at the top (chin over bar)                 |
| dip      | side_1 (normal), side_2 (dim), diag45_1                           | hold_side.mp4 at the bottom (upper arm parallel to floor) |
| squat    | side_1 (normal), side_2 (dim), diag45_1                           | hold_side.mp4 at the bottom (hip crease below knee)       |

Each rep clip is `<view>_<take>.mp4`, for example `clips/push_up/side_1.mp4`.
Use one take in normal indoor light and one in dim light.
