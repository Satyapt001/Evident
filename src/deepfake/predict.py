"""Public prediction interface for the genuine DF40 detector."""
from pathlib import Path
from typing import Any

from .inference import DeepfakeDetector, TECHNICAL_MODEL_NAME, PUBLIC_MODEL_NAME
from .preprocessing import load_image

DEFAULT_CHECKPOINT = (
    Path(__file__).resolve().parents[2]
    / "external"
    / "DeepfakeBench_DF40"
    / "DF40"
    / "DeepfakeBench_DF40"
    / "training"
    / "df40_weights"
    / "train_on_fs"
    / "clip.pth"
)

_detector_cache: dict[str, DeepfakeDetector] = {}


def get_detector(checkpoint_path: str | Path | None = None) -> DeepfakeDetector:
    """Return a cached detector for the exact configured checkpoint."""
    checkpoint = Path(checkpoint_path or DEFAULT_CHECKPOINT).resolve()
    key = str(checkpoint)
    detector = _detector_cache.get(key)
    if detector is None:
        detector = DeepfakeDetector(checkpoint)
        _detector_cache[key] = detector
    return detector


def predict_image(image_path: str | Path, checkpoint_path: str | Path | None = None) -> dict[str, Any]:
    """Run genuine DF40 inference using the checkpoint selected by the backend configuration."""
    image = load_image(image_path)
    detector = get_detector(checkpoint_path)
    result = detector.predict(image)
    return {
        "image": str(image_path),
        "model": PUBLIC_MODEL_NAME,
        "technical_model": TECHNICAL_MODEL_NAME,
        "checkpoint": str(detector.checkpoint_path),
        **result,
    }
