"""Every file is verified against a pinned SHA-256 before it is written, so a
changed upstream file (or a truncated download) is rejected instead of silently
skewing evaluation results.
"""

import hashlib
import io
import shutil
import sys
import tarfile
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODELS = ROOT / "models"
REPO = ROOT.parent.parent
TIMEOUT_SECONDS = 120

FETCH_ERRORS = (urllib.error.URLError, OSError, tarfile.TarError, ValueError)


@dataclass(frozen=True)
class Source:
    url: str
    is_tar_gz: bool = False


@dataclass(frozen=True)
class Model:
    name: str
    sha256: str
    sources: tuple[Source, ...]
    local: Path | None = None


MODEL_LIST = (
    Model(
        name="movenet_lightning_int8.tflite",
        sha256="cd7cc22fa946e5d146a7b98d496853e1923e22828d3972d579973f27f91bb105",
        sources=(
            Source(
                "https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/int8/4?lite-format=tflite"
            ),
            Source(
                "https://www.kaggle.com/api/v1/models/google/movenet/tfLite/singlepose-lightning-tflite-int8/1/download",
                is_tar_gz=True,
            ),
        ),
        local=REPO
        / "apps/native/assets/models/movenet_singlepose_lightning_int8.tflite",
    ),
    Model(
        name="movenet_thunder_int8.tflite",
        sha256="b72fed22707cd6fb94b5a248b9bddb9c062b9f445471b4fa263407cf6d222011",
        sources=(
            Source(
                "https://tfhub.dev/google/lite-model/movenet/singlepose/thunder/tflite/int8/4?lite-format=tflite"
            ),
            Source(
                "https://www.kaggle.com/api/v1/models/google/movenet/tfLite/singlepose-thunder-tflite-int8/1/download",
                is_tar_gz=True,
            ),
        ),
    ),
    Model(
        name="pose_landmarker_full.task",
        sha256="4eaa5eb7a98365221087693fcc286334cf0858e2eb6e15b506aa4a7ecdcec4ad",
        sources=(
            Source(
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task"
            ),
        ),
    ),
)


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS) as resp:
        return resp.read() 


def tflite_from_tar_gz(data: bytes) -> bytes:
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        members = [m for m in tar.getmembers() if m.name.endswith(".tflite")]
        if len(members) != 1:
            raise ValueError("expected exactly one .tflite in archive")
        extracted = tar.extractfile(members[0])
        if extracted is None:
            raise ValueError("tflite member is not a regular file")
        return extracted.read()


def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_atomic(target: Path, data: bytes) -> None:
    """Write via a temp file so an interrupted run never leaves a partial model."""
    tmp = target.with_name(target.name + ".part")
    tmp.write_bytes(data)
    tmp.replace(target)


def fetch_verified(model: Model, source: Source) -> bytes | None:
    try:
        data = fetch(source.url)
        if source.is_tar_gz:
            data = tflite_from_tar_gz(data)
    except FETCH_ERRORS as exc:
        print(f"failed {source.url}: {exc}")
        return None
    if sha256_of(data) != model.sha256:
        print(f"failed {source.url}: SHA-256 mismatch")
        return None
    return data


def get_model(model: Model) -> bool:
    target = MODELS / model.name
    if target.exists():
        if sha256_of(target.read_bytes()) == model.sha256:
            print(f"skip {model.name} (exists)")
            return True
        print(f"replacing {model.name} (checksum mismatch)")
        target.unlink()

    for source in model.sources:
        data = fetch_verified(model, source)
        if data is not None:
            write_atomic(target, data)
            print(f"ok {model.name} <- {source.url}")
            return True

    local = model.local
    if local is not None and local.exists():
        data = local.read_bytes()
        if sha256_of(data) == model.sha256:
            shutil.copyfile(local, target)
            print(f"ok {model.name} <- {local}")
            return True

    tried = [s.url for s in model.sources]
    print(f"MISSING {model.name}\n  tried: {tried}\n  place it manually at: {target}")
    return False


def main() -> int:
    MODELS.mkdir(parents=True, exist_ok=True)
    results = [get_model(m) for m in MODEL_LIST]
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
