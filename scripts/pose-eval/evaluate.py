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
from pathlib import Path

import cv2
import numpy as np
import tensorflow as tf

ROOT = Path(__file__).resolve().parent
MODELS_DIR = ROOT / "models"

DETECTION_THRESHOLD = 0.3
MIN_DETECTION_RATE = 0.90
MIN_MEAN_CONFIDENCE = 0.50

KEY_JOINTS = {
    "push_up": ["shoulders", "elbows", "wrists", "hips", "ankles"],
    "pull_up": ["wrists", "elbows", "shoulders", "nose"],
    "dip": ["shoulders", "elbows", "wrists", "hips"],
    "squat": ["hips", "knees", "ankles", "shoulders"],
}
EXERCISES = list(KEY_JOINTS)

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


def expand(exercise):
    """Expand group names ('shoulders') to per-side joint names."""
    names = []
    for group in KEY_JOINTS[exercise]:
        if group == "nose":
            names.append("nose")
        else:
            single = group[:-1]
            names += [f"l_{single}", f"r_{single}"]
    return names


class MoveNet:
    def __init__(self, name, path):
        self.name = name
        self.index = MOVENET_INDEX
        self.interp = tf.lite.Interpreter(model_path=str(path))
        self.interp.allocate_tensors()
        self.inp = self.interp.get_input_details()[0]
        self.out = self.interp.get_output_details()[0]
        self.size = int(self.inp["shape"][1])

    def confidences(self, frame_rgb):
        h, w = frame_rgb.shape[:2]
        scale = self.size / max(h, w)
        nh, nw = max(1, int(h * scale)), max(1, int(w * scale))
        resized = cv2.resize(frame_rgb, (nw, nh))
        canvas = np.zeros((self.size, self.size, 3), dtype=np.uint8)
        canvas[:nh, :nw] = resized
        data = canvas[None]
        data = data.astype(self.inp["dtype"])
        self.interp.set_tensor(self.inp["index"], data)
        self.interp.invoke()
        kp = self.interp.get_tensor(self.out["index"])
        assert kp.shape == (1, 1, 17, 3), kp.shape
        return {j: float(kp[0, 0, i, 2]) for j, i in self.index.items()}

    def reset(self):
        pass


class BlazePose:
    name = "blazepose_full"
    index = BLAZEPOSE_INDEX

    def __init__(self, path):
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision

        self.mp = mp
        self.mp_python = mp_python
        self.vision = vision
        self.path = path
        self.landmarker = None
        self.reset()

    def reset(self):
        if self.landmarker is not None:
            self.landmarker.close()
        options = self.vision.PoseLandmarkerOptions(
            base_options=self.mp_python.BaseOptions(
                model_asset_path=str(self.path)
            ),
            running_mode=self.vision.RunningMode.VIDEO,
            num_poses=1,
        )
        self.landmarker = self.vision.PoseLandmarker.create_from_options(
            options
        )

    def confidences(self, frame_rgb, timestamp_ms=0):
        image = self.mp.Image(
            image_format=self.mp.ImageFormat.SRGB,
            data=np.ascontiguousarray(frame_rgb),
        )
        result = self.landmarker.detect_for_video(image, int(timestamp_ms))
        if not result.pose_landmarks:
            return {j: 0.0 for j in self.index}
        lm = result.pose_landmarks[0]
        assert len(lm) == 33, len(lm)
        return {j: float(lm[i].visibility) for j, i in self.index.items()}


def load_models():
    return [
        MoveNet("movenet_lightning", MODELS_DIR / "movenet_lightning_int8.tflite"),
        MoveNet("movenet_thunder", MODELS_DIR / "movenet_thunder_int8.tflite"),
        BlazePose(MODELS_DIR / "pose_landmarker_full.task"),
    ]


def run_model(model, frame_rgb, ts_ms):
    if isinstance(model, BlazePose):
        return model.confidences(frame_rgb, ts_ms)
    return model.confidences(frame_rgb)


def sample_frames(path, fps):
    cap = cv2.VideoCapture(str(path))
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    step = max(1, int(round(src_fps / fps)))
    i = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i % step == 0:
            yield int(i / src_fps * 1000), cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        i += 1
    cap.release()


def find_clips(clips_dir):
    found = {}
    for ex in EXERCISES:
        files = sorted((Path(clips_dir) / ex).glob("*.mp4"))
        found[ex] = {
            "all": [f for f in files if not f.name.startswith("hold_")],
            "hold": [f for f in files if f.name.startswith("hold_")],
        }
    return found


def evaluate(models, clips, fps):
    """Return rows and aggregate {(model, exercise, subset): (det, conf, frames)}."""
    rows = []
    agg = {}
    for model in models:
        for ex in EXERCISES:
            joints = expand(ex)
            for subset in ("all", "hold"):
                confs = {j: [] for j in joints}
                for clip in clips[ex][subset]:
                    model.reset()
                    for ts, frame in sample_frames(clip, fps):
                        c = run_model(model, frame, ts)
                        for j in joints:
                            confs[j].append(c[j])
                frames = len(confs[joints[0]])
                if frames == 0:
                    continue
                for j in joints:
                    arr = np.array(confs[j])
                    rows.append(
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
                sel = [
                    r
                    for r in rows
                    if r["model"] == model.name
                    and r["exercise"] == ex
                    and r["subset"] == subset
                ]
                agg[(model.name, ex, subset)] = (
                    float(np.mean([r["detection_rate"] for r in sel])),
                    float(np.mean([r["mean_confidence"] for r in sel])),
                    frames,
                )
    return rows, agg


def passes(agg, model, ex):
    for subset in ("all", "hold"):
        entry = agg.get((model, ex, subset))
        if entry is None:
            return False
        det, conf, _ = entry
        if det < MIN_DETECTION_RATE or conf < MIN_MEAN_CONFIDENCE:
            return False
    return True


def decide(agg, model_names):
    """model_names is ordered lightest first."""
    counts = {m: sum(passes(agg, m, ex) for ex in EXERCISES) for m in model_names}
    for m in model_names:
        if counts[m] == len(EXERCISES):
            return m, counts, True
    best = max(counts.values())
    winner = next(m for m in model_names if counts[m] == best)
    return winner, counts, False


def write_outputs(rows, agg, model_names, out_dir):
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

    winner, counts, all_pass = decide(agg, model_names)
    lines = ["# Pose model evaluation", ""]
    for ex in EXERCISES:
        lines += [
            f"## {ex}",
            "",
            "| model | subset | detection rate | mean confidence | frames | result |",
            "| ----- | ------ | -------------- | --------------- | ------ | ------ |",
        ]
        for m in model_names:
            verdict = "PASS" if passes(agg, m, ex) else "FAIL"
            for subset in ("all", "hold"):
                e = agg.get((m, ex, subset))
                if e is None:
                    lines.append(f"| {m} | {subset} | n/a | n/a | 0 | {verdict} |")
                else:
                    lines.append(
                        f"| {m} | {subset} | {e[0]:.3f} | {e[1]:.3f} | {e[2]} | {verdict} |"
                    )
        lines.append("")
    summary = ", ".join(f"{m}: {counts[m]}/4" for m in model_names)
    lines.append(
        f"Decision: {winner} ({'passes all four exercises' if all_pass else 'most passes, no model passes all four'}; {summary})"
    )
    lines.append("")
    (out / "summary.md").write_text("\n".join(lines), encoding="utf-8")
    print(lines[-2])


def self_test(clips_dir):
    models = load_models()
    frames = [np.zeros((480, 640, 3), dtype=np.uint8)]
    for clip in sorted(Path(clips_dir).glob("*/*.mp4")):
        for _, frame in sample_frames(clip, 1):
            frames.append(frame)
            break
        break
    for model in models:
        for i, frame in enumerate(frames):
            c = run_model(model, frame, i * 100)
            assert set(c) == set(model.index), model.name
            assert all(isinstance(v, float) for v in c.values())
        print(f"ok {model.name}")
    return 0


def main():
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
    rows, agg = evaluate(models, clips, args.fps)
    write_outputs(rows, agg, [m.name for m in models], args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
