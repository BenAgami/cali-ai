"""Offline evaluation of candidate pose models on real exercise clips.

Candidates (lightest first): MoveNet Lightning, MoveNet Thunder, BlazePose full.
A model PASSES an exercise if, over the exercise's key joints, detection rate
(confidence >= 0.3) is >= 0.90 and mean confidence is >= 0.50, on both all
non-hold clips and hold clips. The lightest model passing all four exercises
wins; otherwise the model with the most passes (ties -> lighter).
"""

import argparse
import csv
import sys
from collections.abc import Iterator
from pathlib import Path
from typing import NamedTuple, Protocol

import cv2
import mediapipe as mp
import numpy as np
import tensorflow as tf
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

ROOT = Path(__file__).resolve().parent
MODELS_DIR = ROOT / "models"

CLIP_SUFFIXES = (".mp4", ".mov")

DETECTION_THRESHOLD = 0.3
MIN_DETECTION_RATE = 0.90
MIN_MEAN_CONFIDENCE = 0.50

MOVENET_KEYPOINTS = 17
BLAZEPOSE_LANDMARKS = 33

SUBSETS = ("all", "hold")

KEY_JOINTS = {
    "push_up": ["shoulders", "elbows", "wrists", "hips", "ankles"],
    "pull_up": ["wrists", "elbows", "shoulders", "nose"],
    "dip": ["shoulders", "elbows", "wrists", "hips"],
    "squat": ["hips", "knees", "ankles", "shoulders"],
}
EXERCISES = list(KEY_JOINTS)

NEAR_SIDE_EXERCISES = {"push_up", "dip"}

MOVENET_INDEX = {
    "nose": 0,
    "l_eye": 1,
    "r_eye": 2,
    "l_ear": 3,
    "r_ear": 4,
    "l_shoulder": 5,
    "r_shoulder": 6,
    "l_elbow": 7,
    "r_elbow": 8,
    "l_wrist": 9,
    "r_wrist": 10,
    "l_hip": 11,
    "r_hip": 12,
    "l_knee": 13,
    "r_knee": 14,
    "l_ankle": 15,
    "r_ankle": 16,
}
BLAZEPOSE_INDEX = {
    "nose": 0,
    "l_shoulder": 11,
    "r_shoulder": 12,
    "l_elbow": 13,
    "r_elbow": 14,
    "l_wrist": 15,
    "r_wrist": 16,
    "l_hip": 23,
    "r_hip": 24,
    "l_knee": 25,
    "r_knee": 26,
    "l_ankle": 27,
    "r_ankle": 28,
}

Row = dict[str, str | float | int]


class Stats(NamedTuple):
    detection_rate: float
    mean_confidence: float
    frames: int


class ResultKey(NamedTuple):
    model: str
    exercise: str
    subset: str


StatsByResult = dict[ResultKey, Stats]


def per_side_joint_names(exercise: str) -> list[str]:
    names: list[str] = []
    for group in KEY_JOINTS[exercise]:
        if group == "nose":
            names.append("nose")
        else:
            single = group[:-1]
            names += [f"l_{single}", f"r_{single}"]
    return names


class PoseModel(Protocol):
    name: str
    index: dict[str, int]

    def confidences(self, frame_rgb: np.ndarray, ts_ms: int) -> dict[str, float]: ...

    def reset(self) -> None: ...


class MoveNet:
    def __init__(self, name: str, path: Path) -> None:
        self.name = name
        self.index = MOVENET_INDEX
        self.interp = tf.lite.Interpreter(model_path=str(path))
        self.interp.allocate_tensors()
        self.inp = self.interp.get_input_details()[0]
        self.out = self.interp.get_output_details()[0]
        self.size = int(self.inp["shape"][1])

    def confidences(self, frame_rgb: np.ndarray, ts_ms: int = 0) -> dict[str, float]:
        h, w = frame_rgb.shape[:2]
        scale = self.size / max(h, w)
        nh, nw = max(1, int(h * scale)), max(1, int(w * scale))
        resized = cv2.resize(frame_rgb, (nw, nh))
        canvas = np.zeros((self.size, self.size, 3), dtype=np.uint8)
        canvas[:nh, :nw] = resized
        data = canvas[None].astype(self.inp["dtype"])
        self.interp.set_tensor(self.inp["index"], data)
        self.interp.invoke()
        kp = self.interp.get_tensor(self.out["index"])
        if kp.shape != (1, 1, MOVENET_KEYPOINTS, 3):
            raise ValueError(f"unexpected MoveNet output shape {kp.shape}")
        return {j: float(kp[0, 0, i, 2]) for j, i in self.index.items()}

    def reset(self) -> None:
        pass


class BlazePose:
    name = "blazepose_full"
    index = BLAZEPOSE_INDEX

    def __init__(self, path: Path) -> None:
        self.path = path
        self.landmarker = self._create()

    def _create(self) -> vision.PoseLandmarker:
        options = vision.PoseLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=str(self.path)),
            running_mode=vision.RunningMode.VIDEO,
            num_poses=1,
        )
        return vision.PoseLandmarker.create_from_options(options)

    def reset(self) -> None:
        """VIDEO mode needs increasing timestamps, so restart for each clip."""
        self.landmarker.close()
        self.landmarker = self._create()

    def confidences(self, frame_rgb: np.ndarray, ts_ms: int = 0) -> dict[str, float]:
        image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=np.ascontiguousarray(frame_rgb),
        )
        result = self.landmarker.detect_for_video(image, int(ts_ms))
        if not result.pose_landmarks:
            return {j: 0.0 for j in self.index}
        lm = result.pose_landmarks[0]
        if len(lm) != BLAZEPOSE_LANDMARKS:
            raise ValueError(f"unexpected BlazePose landmark count {len(lm)}")
        return {j: float(lm[i].visibility) for j, i in self.index.items()}


def load_models() -> list[PoseModel]:
    """Lightest first; `decide` relies on this order."""
    return [
        MoveNet("movenet_lightning", MODELS_DIR / "movenet_lightning_int8.tflite"),
        MoveNet("movenet_thunder", MODELS_DIR / "movenet_thunder_int8.tflite"),
        BlazePose(MODELS_DIR / "pose_landmarker_full.task"),
    ]


def sample_frames(path: Path, fps: float) -> Iterator[tuple[int, np.ndarray]]:
    cap = cv2.VideoCapture(str(path))
    try:
        if not cap.isOpened():
            raise RuntimeError(f"cannot open video: {path}")
        src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        step = max(1, round(src_fps / fps))
        i = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if i % step == 0:
                yield int(i / src_fps * 1000), cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            i += 1
    finally:
        cap.release()


def list_clip_files(directory: Path) -> list[Path]:
    return sorted(f for f in directory.iterdir() if f.suffix.lower() in CLIP_SUFFIXES)


def find_clips(clips_dir: str | Path) -> dict[str, dict[str, list[Path]]]:
    found = {}
    for ex in EXERCISES:
        files = list_clip_files(Path(clips_dir) / ex)
        found[ex] = {
            "all": [f for f in files if not f.name.startswith("hold_")],
            "hold": [f for f in files if f.name.startswith("hold_")],
        }
    return found


def near_side(clip_confs: dict[str, list[float]]) -> str:
    """The side ("l" or "r") whose joints are detected more confidently."""
    mean = {
        side: np.mean(
            [v for j, vals in clip_confs.items() if j[0] == side for v in vals]
        )
        for side in ("l", "r")
    }
    return max(mean, key=lambda side: mean[side])


def collect_confidences(
    model: PoseModel, exercise: str, clips: list[Path], fps: float
) -> dict[str, list[float]]:
    """Per-joint confidences; near-side exercises use side-agnostic joint names."""
    joints = per_side_joint_names(exercise)
    side_agnostic = exercise in NEAR_SIDE_EXERCISES
    confs: dict[str, list[float]] = {
        (j[2:] if side_agnostic else j): [] for j in joints
    }
    for clip in clips:
        model.reset()
        clip_confs: dict[str, list[float]] = {j: [] for j in joints}
        for ts, frame in sample_frames(clip, fps):
            c = model.confidences(frame, ts)
            for j in joints:
                clip_confs[j].append(c[j])
        side = near_side(clip_confs) if side_agnostic else None
        for j, vals in clip_confs.items():
            if not side_agnostic:
                confs[j].extend(vals)
            elif j[0] == side:
                confs[j[2:]].extend(vals)
    return confs


def evaluate(
    models: list[PoseModel],
    clips: dict[str, dict[str, list[Path]]],
    fps: float,
) -> tuple[list[Row], StatsByResult]:
    """Return per-joint rows and per-`ResultKey` aggregates."""
    rows: list[Row] = []
    stats_by_result: StatsByResult = {}
    for model in models:
        for ex in EXERCISES:
            for subset in SUBSETS:
                confs = collect_confidences(model, ex, clips[ex][subset], fps)
                joints = list(confs)
                frames = len(confs[joints[0]])
                if frames == 0:
                    continue
                subset_rows: list[Row] = []
                for j in joints:
                    arr = np.array(confs[j])
                    subset_rows.append(
                        {
                            "model": model.name,
                            "exercise": ex,
                            "subset": subset,
                            "joint": j,
                            "mean_confidence": round(float(arr.mean()), 4),
                            "detection_rate": round(
                                float((arr >= DETECTION_THRESHOLD).mean()), 4
                            ),
                            "frames": frames,
                        }
                    )
                rows.extend(subset_rows)
                stats_by_result[ResultKey(model.name, ex, subset)] = Stats(
                    detection_rate=float(
                        np.mean([r["detection_rate"] for r in subset_rows])
                    ),
                    mean_confidence=float(
                        np.mean([r["mean_confidence"] for r in subset_rows])
                    ),
                    frames=frames,
                )
    return rows, stats_by_result


def passes(stats_by_result: StatsByResult, model: str, ex: str) -> bool:
    for subset in SUBSETS:
        stats = stats_by_result.get(ResultKey(model, ex, subset))
        if stats is None:
            return False
        if (
            stats.detection_rate < MIN_DETECTION_RATE
            or stats.mean_confidence < MIN_MEAN_CONFIDENCE
        ):
            return False
    return True


def decide(
    stats_by_result: StatsByResult, model_names: list[str]
) -> tuple[str, dict[str, int], bool]:
    """model_names is ordered lightest first."""
    counts = {
        m: sum(passes(stats_by_result, m, ex) for ex in EXERCISES) for m in model_names
    }
    for m in model_names:
        if counts[m] == len(EXERCISES):
            return m, counts, True
    best = max(counts.values())
    winner = next(m for m in model_names if counts[m] == best)
    return winner, counts, False


def write_outputs(
    rows: list[Row],
    stats_by_result: StatsByResult,
    model_names: list[str],
    out_dir: str | Path,
) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    fields = [
        "model",
        "exercise",
        "subset",
        "joint",
        "mean_confidence",
        "detection_rate",
        "frames",
    ]
    with open(out / "summary.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    winner, counts, all_pass = decide(stats_by_result, model_names)
    lines = ["# Pose model evaluation", ""]
    for ex in EXERCISES:
        lines += [
            f"## {ex}",
            "",
            "| model | subset | detection rate | mean confidence | frames | result |",
            "| ----- | ------ | -------------- | --------------- | ------ | ------ |",
        ]
        for m in model_names:
            verdict = "PASS" if passes(stats_by_result, m, ex) else "FAIL"
            for subset in SUBSETS:
                stats = stats_by_result.get(ResultKey(m, ex, subset))
                if stats is None:
                    lines.append(f"| {m} | {subset} | n/a | n/a | 0 | {verdict} |")
                else:
                    lines.append(
                        f"| {m} | {subset} | {stats.detection_rate:.3f} "
                        f"| {stats.mean_confidence:.3f} | {stats.frames} "
                        f"| {verdict} |"
                    )
        lines.append("")
    summary = ", ".join(f"{m}: {counts[m]}/{len(EXERCISES)}" for m in model_names)
    reason = (
        "passes all four exercises"
        if all_pass
        else "most passes, no model passes all four"
    )
    decision = f"Decision: {winner} ({reason}; {summary})"
    lines += [decision, ""]
    (out / "summary.md").write_text("\n".join(lines), encoding="utf-8")
    print(decision)


def self_test(clips_dir: str | Path) -> int:
    models = load_models()
    frames = [np.zeros((480, 640, 3), dtype=np.uint8)]
    for clip in (
        c
        for ex_dir in sorted(p for p in Path(clips_dir).iterdir() if p.is_dir())
        for c in list_clip_files(ex_dir)
    ):
        for _, frame in sample_frames(clip, 1):
            frames.append(frame)
            break
        break
    for model in models:
        for i, frame in enumerate(frames):
            c = model.confidences(frame, i * 100)
            assert set(c) == set(model.index), model.name
            assert all(isinstance(v, float) for v in c.values())
        print(f"ok {model.name}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--clips", default=str(ROOT / "clips"))
    p.add_argument("--fps", type=float, default=10)
    p.add_argument("--out", default=str(ROOT / "results"))
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args()

    if args.self_test:
        return self_test(args.clips)

    models = load_models()
    clips = find_clips(args.clips)
    for ex in EXERCISES:
        print(ex, len(clips[ex]["all"]), "rep clips,", len(clips[ex]["hold"]), "hold")
    rows, stats_by_result = evaluate(models, clips, args.fps)
    write_outputs(rows, stats_by_result, [m.name for m in models], args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
