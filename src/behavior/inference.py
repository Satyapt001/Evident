"""Production inference helper for Model 3 network threat detection."""
from pathlib import Path

import joblib
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = PROJECT_ROOT / "models" / "behavior" / "production" / "network_threat_model.pkl"
_CACHE = None


def load_model():
    global _CACHE
    if _CACHE is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Missing production model: {MODEL_PATH}")
        _CACHE = joblib.load(MODEL_PATH)
    return _CACHE


def predict_network_flow(features: dict) -> dict:
    artifact = load_model()
    columns = artifact["feature_columns"]

    # The UI supports analyst-entered partial flow samples. Missing fields are
    # represented as NaN so the production pipeline applies its trained median
    # imputation rather than introducing artificial zero-valued traffic features.
    normalized = {column: features.get(column, float("nan")) for column in columns}
    X = pd.DataFrame([normalized], columns=columns)

    p = float(artifact["binary_model"].predict_proba(X)[0, 1])
    attack = p >= 0.5
    family = "BENIGN"
    if attack:
        family = str(artifact["family_model"].predict(X)[0])

    score = round(p * 100, 2)
    if score >= 80:
        level = "CRITICAL"
    elif score >= 60:
        level = "HIGH"
    elif score >= 40:
        level = "MEDIUM"
    elif score >= 20:
        level = "LOW"
    else:
        level = "SAFE"

    return {
        "model": "EVIDENT Network Threat Detector",
        "prediction": "ATTACK" if attack else "BENIGN",
        "attack_probability": round(p, 6),
        "attack_family": family,
        "risk_score": score,
        "risk_level": level,
        "features_received": len(features),
        "features_used": len(columns),
    }


# Backward-compatible alias for any older route/import.
def predict_flow(features: dict) -> dict:
    result = predict_network_flow(features)
    return {
        "model": result["model"],
        "prediction": result["prediction"],
        "attack_probability": result["attack_probability"],
        "attack_category": result["attack_family"],
        "risk_score": result["risk_score"],
        "risk_level": result["risk_level"],
    }
