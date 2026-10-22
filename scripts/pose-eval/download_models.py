"""Download the three candidate pose models into scripts/pose-eval/models/."""

import io
import shutil
import sys
import tarfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODELS = ROOT / "models"
REPO = ROOT.parent.parent
MIN_BYTES = 1_000_000

MOVENET = {
    "movenet_lightning_int8.tflite": {
        "urls": [
            "https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/int8/4?lite-format=tflite",
        ],
        "kaggle": "https://www.kaggle.com/api/v1/models/google/movenet/tfLite/singlepose-lightning-tflite-int8/1/download",
        "local": REPO
        / "apps/native/assets/models/movenet_singlepose_lightning_int8.tflite",
    },
    "movenet_thunder_int8.tflite": {
        "urls": [
            "https://tfhub.dev/google/lite-model/movenet/singlepose/thunder/tflite/int8/4?lite-format=tflite",
        ],
        "kaggle": "https://www.kaggle.com/api/v1/models/google/movenet/tfLite/singlepose-thunder-tflite-int8/1/download",
        "local": None,
    },
}

LANDMARKER = (
    "pose_landmarker_full.task",
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
)


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=120) as resp:
        return resp.read()


def valid_tflite(data: bytes) -> bool:
    return len(data) > MIN_BYTES and data[4:8] == b"TFL3"


def from_tar(data: bytes) -> bytes:
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        members = [m for m in tar.getmembers() if m.name.endswith(".tflite")]
        if len(members) != 1:
            raise ValueError("expected exactly one .tflite in archive")
        extracted = tar.extractfile(members[0])
        if extracted is None:
            raise ValueError("tflite member is not a regular file")
        return extracted.read()


def get_movenet(name: str, spec: dict) -> bool:
    target = MODELS / name
    if target.exists():
        if valid_tflite(target.read_bytes()):
            print(f"skip {name} (exists)")
            return True
        target.unlink()
    attempts = []
    for url in spec["urls"]:
        attempts.append(url)
        try:
            data = fetch(url)
            if valid_tflite(data):
                target.write_bytes(data)
                print(f"ok {name} <- {url}")
                return True
        except Exception as exc:  # noqa: BLE001
            print(f"failed {url}: {exc}")
    attempts.append(spec["kaggle"])
    try:
        data = from_tar(fetch(spec["kaggle"]))
        if valid_tflite(data):
            target.write_bytes(data)
            print(f"ok {name} <- kaggle")
            return True
    except Exception as exc:  # noqa: BLE001
        print(f"failed kaggle: {exc}")
    local = spec["local"]
    if local is not None and local.exists():
        data = local.read_bytes()
        if valid_tflite(data):
            shutil.copyfile(local, target)
            print(f"ok {name} <- {local}")
            return True
    print(f"MISSING {name}\n  tried: {attempts}\n  place it manually at: {target}")
    return False


def get_landmarker() -> bool:
    name, url = LANDMARKER
    target = MODELS / name
    if target.exists() and target.stat().st_size > MIN_BYTES:
        print(f"skip {name} (exists)")
        return True
    try:
        data = fetch(url)
        if len(data) > MIN_BYTES:
            target.write_bytes(data)
            print(f"ok {name}")
            return True
    except Exception as exc:  # noqa: BLE001
        print(f"failed {url}: {exc}")
    print(f"MISSING {name}\n  tried: {url}\n  place it manually at: {target}")
    return False


def main() -> int:
    MODELS.mkdir(exist_ok=True)
    results = [get_movenet(n, s) for n, s in MOVENET.items()]
    results.append(get_landmarker())
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
