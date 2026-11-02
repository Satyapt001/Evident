"""Production inference wrapper for the saved phishing model."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd


class PhishingModel:
    def __init__(self, model_path: str | Path, metadata_path: str | Path):
        self.model_path = Path(model_path)
        self.metadata_path = Path(metadata_path)

        if not self.model_path.exists():
            raise FileNotFoundError(f"Model not found: {self.model_path}")
        if not self.metadata_path.exists():
            raise FileNotFoundError(f"Metadata not found: {self.metadata_path}")

        self.model = joblib.load(self.model_path)

        with self.metadata_path.open("r", encoding="utf-8") as f:
            self.metadata = json.load(f)

        self.features = self.metadata["features"]

        if len(self.features) != self.metadata["feature_count"]:
            raise ValueError("Metadata feature count does not match feature list.")

    def predict_features(self, features: dict) -> dict:
        missing = [f for f in self.features if f not in features]
        if missing:
            raise ValueError(f"Missing model features: {missing}")

        frame = pd.DataFrame([[features[f] for f in self.features]], columns=self.features)

        prediction = int(self.model.predict(frame)[0])

        result = {
            "prediction": "phishing" if prediction == 1 else "legitimate",
            "prediction_class": prediction,
            "model": self.metadata.get("model_name", type(self.model).__name__),
            "feature_count": len(self.features),
        }

        if hasattr(self.model, "predict_proba"):
            probabilities = self.model.predict_proba(frame)[0]
            result["probability"] = float(max(probabilities))
            result["phishing_probability"] = float(
                probabilities[1] if len(probabilities) > 1 else probabilities[0]
            )

        return result
