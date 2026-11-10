"""Dump BlazePose skeletons from the evaluation clips as PoseCapturePayload
fixtures (skeleton coordinates only, no imagery).

Usage:
    scripts/pose-eval/.venv/Scripts/python scripts/pose-eval/dump_keypoints.py
"""

import argparse
import gzip
import json
import sys
from pathlib import Path

import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

from evaluate import MODELS_DIR, find_clips, sample_frames

ROOT = Path(__file__).resolve().parents[2]
LANDMARKS = 33
MAX_DURATION_SEC = 180

# Mirrors FORM_CAPTURE_SETUP in @repo/common.
RECOMMENDED_VIEW = {
    "push_up": "side",
    "dip": "side",
    "squat": "side",
    "pull_up": "front",
}

# Dim-light takes per the shot list; everything else is normal light.
DIM_CLIPS = {("push_up", "side_2"), ("dip", "diag45_1"), ("squat", "side_2")}


def clip_view(exercise: str, stem: str) -> str:
    if "front" in stem:
        return "front"
    if "back" in stem:
        return "back"
    if "diag45" in stem:
        return "diag45"
    return "side"


def camera_view(exercise: str, stem: str) -> str:
    if stem == "front_1":
        return "front"
    if stem == "back_1":
        return "back"
    return RECOMMENDED_VIEW[exercise]


def create_landmarker() -> vision.PoseLandmarker:
    options = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(
            model_asset_path=str(MODELS_DIR / "pose_landmarker_full.task")
        ),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
    )
    return vision.PoseLandmarker.create_from_options(options)


def dump_clip(path: Path, exercise: str, fps: float) -> dict:
    landmarker = create_landmarker()
    frames = []
    aspect_ratio = None
    try:
        for index, (ts_ms, rgb) in enumerate(sample_frames(path, fps)):
            if aspect_ratio is None:
                height, width = rgb.shape[:2]
                aspect_ratio = round(width / height, 4)
            image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=np.ascontiguousarray(rgb),
            )
            result = landmarker.detect_for_video(image, int(ts_ms))
            if result.pose_landmarks:
                lm = result.pose_landmarks[0]
                if len(lm) != LANDMARKS:
                    raise ValueError(f"unexpected landmark count {len(lm)}")
                keypoints = [
                    [round(p.x, 3), round(p.y, 3), round(p.visibility, 2)]
                    for p in lm
                ]
            else:
                keypoints = [[0, 0, 0] for _ in range(LANDMARKS)]
            frames.append(
                {"timestampSec": round(index / fps, 3), "keypoints": keypoints}
            )
    finally:
        landmarker.close()
    if not frames:
        raise RuntimeError(f"no frames decoded: {path}")
    duration = min(MAX_DURATION_SEC, round(frames[-1]["timestampSec"] + 1 / fps, 3))
    stem = path.stem.lower()
    return {
        "version": 1,
        "poseModelName": "blazepose_full",
        "poseModelVersion": "pose_landmarker_full.task",
        "fps": fps,
        "frameCount": len(frames),
        "durationSec": duration,
        "cameraView": camera_view(exercise, stem),
        "aspectRatio": aspect_ratio,
        "frames": frames,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clips", default=str(ROOT / "scripts/pose-eval/clips"))
    parser.add_argument("--fps", type=float, default=15)
    parser.add_argument(
        "--out", default=str(ROOT / "apps/api/tests/unit/metrics/fixtures")
    )
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    fps = int(args.fps) if float(args.fps).is_integer() else args.fps
    manifest = []
    for exercise, groups in find_clips(args.clips).items():
        for kind, clips in (("reps", groups["all"]), ("hold", groups["hold"])):
            for path in clips:
                stem = path.stem.lower()
                name = f"{exercise}__{stem}.json.gz"
                payload = dump_clip(path, exercise, fps)
                data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
                with gzip.GzipFile(out / name, "wb", mtime=0) as f:
                    f.write(data)
                size = (out / name).stat().st_size
                print(f"{name}: {payload['frameCount']} frames, {size} bytes")
                manifest.append(
                    {
                        "file": name,
                        "exercise": exercise,
                        "clip": stem,
                        "kind": kind,
                        "view": clip_view(exercise, stem),
                        "light": "dim" if (exercise, stem) in DIM_CLIPS else "normal",
                        "expectedReps": 5 if kind == "reps" else 0,
                    }
                )
    (out / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"wrote {len(manifest)} fixtures + manifest to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
