from __future__ import annotations
from pathlib import Path
import joblib
import numpy as np

def load_model(path):
    return joblib.load(Path(path))

def predict_network_threat(model_bundle, frame):
    """Predict binary attack probability and optional attack family."""
    features = model_bundle["feature_columns"]
    X = frame.reindex(columns=features)
    binary_model = model_bundle["binary_model"]
    p_attack = binary_model.predict_proba(X)[:, 1]
    binary_pred = (p_attack >= model_bundle.get("binary_threshold", 0.5)).astype(int)
    family_pred = np.array(["BENIGN"] * len(frame), dtype=object)
    attack_mask = binary_pred == 1
    if attack_mask.any() and model_bundle.get("family_model") is not None:
        family_pred[attack_mask] = model_bundle["family_model"].predict(X.loc[attack_mask])
    return binary_pred, p_attack, family_pred
