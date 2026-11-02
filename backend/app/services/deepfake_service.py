
"""Application service for DF40 deepfake analysis."""

import hashlib
import os
import sys
from pathlib import Path

from PIL import Image

from risk_engine.deepfake import calculate_deepfake_risk
from response_engine.deepfake import generate_deepfake_response


# Keep Windows DLL directory handles alive for PyTorch.
_TORCH_DLL_HANDLES = []


def _prepare_torch_runtime() -> None:
    """Prepare Windows DLL search paths before importing DF40."""
    os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("MKL_NUM_THREADS", "1")

    site_packages = Path(sys.prefix) / "Lib" / "site-packages"
    candidates = [site_packages / "torch" / "lib"]

    nvidia_root = site_packages / "nvidia"
    if nvidia_root.is_dir():
        candidates.extend(
            path for path in nvidia_root.glob("*/bin") if path.is_dir()
        )

    valid = [path for path in candidates if path.is_dir()]
    existing_path = os.environ.get("PATH", "").split(os.pathsep)
    existing_normalized = {p.casefold() for p in existing_path if p}

    new_paths = [
        str(path) for path in valid
        if str(path).casefold() not in existing_normalized
    ]
    if new_paths:
        os.environ["PATH"] = os.pathsep.join(new_paths + existing_path)

    if hasattr(os, "add_dll_directory"):
        registered = {
            str(handle) for handle in []
        }
        for directory in valid:
            try:
                handle = os.add_dll_directory(str(directory))
                _TORCH_DLL_HANDLES.append(handle)
            except OSError:
                continue


def _media_metadata(image_path: Path) -> dict:
    """Extract image metadata and calculate its SHA-256 digest."""
    digest = hashlib.sha256()
    with image_path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)

    with Image.open(image_path) as image:
        image_format = image.format or image_path.suffix.lstrip(".").upper()
        width, height = image.size
        color_mode = image.mode

    return {
        "format": image_format,
        "width": width,
        "height": height,
        "color_mode": color_mode,
        "size_bytes": image_path.stat().st_size,
        "sha256": digest.hexdigest(),
    }


class DeepfakeAnalysisService:
    """Run DF40 inference and generate risk and response recommendations."""

    def __init__(self, model_path: str | Path):
        self.model_path = Path(model_path)

    def analyze(self, image_path: str | Path) -> dict:
        image_path = Path(image_path)

        if not self.model_path.is_file():
            raise FileNotFoundError(
                f"Deepfake checkpoint not found: {self.model_path}"
            )
        if not image_path.is_file():
            raise FileNotFoundError(f"Input image not found: {image_path}")

        _prepare_torch_runtime()

        try:
            from src.deepfake.predict import predict_image

            result = predict_image(
                image_path,
                checkpoint_path=self.model_path,
            )
        except OSError as exc:
            raise RuntimeError(
                "DF40/PyTorch native runtime failed. "
                f"Original error: {exc}"
            ) from exc
        except ImportError as exc:
            raise RuntimeError(
                "DF40 dependencies could not be imported. "
                f"Original error: {exc}"
            ) from exc

        probabilities = result["class_probabilities"]
        risk = calculate_deepfake_risk(
            result["class_1_probability"]
        )
        response = generate_deepfake_response(risk)

        model_result = {
            "name": result["model"],
            "technical_name": result["technical_model"],
            "predicted_class": result["predicted_class"],
            "predicted_label": result["predicted_label"],
            "class_probabilities": probabilities,
            "class_1_probability": result["class_1_probability"],
            "confidence": result["confidence"],
            "probability_margin": result.get("probability_margin"),
            "prediction_entropy": result.get("prediction_entropy"),
            "logits": result["logits"],
            "device": result["device"],
            "checkpoint": result.get("checkpoint", str(self.model_path)),
        }

        # These are transparent model outputs, not claims of visual artifacts
        # independently detected in the image.
        evidence = [
            {
                "name": "Class-1 probability",
                "value": result["class_1_probability"],
                "unit": "probability",
                "interpretation": (
                    "Model probability for class 1; interpret according "
                    "to the detector's class mapping."
                ),
            },
            {
                "name": "Prediction confidence",
                "value": result["confidence"],
                "unit": "probability",
                "interpretation": "Maximum probability among the two classes.",
            },
            {
                "name": "Probability margin",
                "value": result["probability_margin"],
                "unit": "probability",
                "interpretation": "Absolute difference between class probabilities.",
            },
        ]

        return {
            "model": model_result,
            "risk": risk,
            "response": response,
            "media": _media_metadata(image_path),
            "analysis_evidence": evidence,
        }
