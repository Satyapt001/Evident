"""Genuine DF40 CLIP ViT-B/16 inference for EVIDENT."""
from pathlib import Path
from typing import Any

import torch
import torch.nn as nn
from transformers import AutoProcessor, CLIPModel

DEFAULT_MODEL_NAME = "openai/clip-vit-base-patch16"
PUBLIC_MODEL_NAME = "DeepGuard Media Authenticity Engine"
TECHNICAL_MODEL_NAME = "DF40 CLIP ViT-B/16"


class DeepfakeDetector:
    """Load the supplied DF40 checkpoint and perform real image inference."""

    def __init__(
        self,
        checkpoint_path: str | Path,
        model_name: str = DEFAULT_MODEL_NAME,
        device: str | None = None,
    ) -> None:
        self.checkpoint_path = Path(checkpoint_path)
        if not self.checkpoint_path.is_file():
            raise FileNotFoundError(f"Deepfake checkpoint not found: {self.checkpoint_path}")

        self.device = torch.device(
            device or ("cuda" if torch.cuda.is_available() else "cpu")
        )

        checkpoint = torch.load(self.checkpoint_path, map_location="cpu")
        state = checkpoint.get("state_dict", checkpoint)
        state = {
            key[7:] if key.startswith("module.") else key: value
            for key, value in state.items()
        }

        self.model = CLIPModel.from_pretrained(model_name)
        self.vision = self.model.vision_model
        self.head = nn.Linear(768, 2)

        backbone_state = {
            key[len("backbone."):]: value
            for key, value in state.items()
            if key.startswith("backbone.")
        }
        head_state = {
            key[len("head."):]: value
            for key, value in state.items()
            if key.startswith("head.")
        }
        if not backbone_state or not head_state:
            raise ValueError("DF40 checkpoint does not contain the expected backbone/head weights.")

        self.vision.load_state_dict(backbone_state, strict=True)
        self.head.load_state_dict(head_state, strict=True)
        self.processor = AutoProcessor.from_pretrained(model_name)

        self.model.to(self.device)
        self.head.to(self.device)
        self.model.eval()
        self.head.eval()

    @torch.inference_mode()
    def predict(self, image) -> dict[str, Any]:
        inputs = self.processor(images=image, return_tensors="pt")
        pixel_values = inputs["pixel_values"].to(self.device)
        features = self.vision(pixel_values=pixel_values).pooler_output
        logits = self.head(features)
        probabilities = torch.softmax(logits, dim=1)[0]

        predicted_class = int(torch.argmax(probabilities).item())
        probs = [float(value) for value in probabilities.detach().cpu().tolist()]
        confidence = max(probs)
        margin = abs(probs[1] - probs[0])
        entropy = 0.0
        for value in probs:
            if value > 0:
                entropy -= value * __import__("math").log(value)

        return {
            "predicted_class": predicted_class,
            "predicted_label": "MANIPULATED" if predicted_class == 1 else "AUTHENTIC",
            "class_probabilities": probs,
            "class_1_probability": probs[1],
            "confidence": confidence,
            "probability_margin": margin,
            "prediction_entropy": entropy,
            "logits": [float(value) for value in logits[0].detach().cpu().tolist()],
            "device": str(self.device),
        }
