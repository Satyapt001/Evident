"""End-to-end CYBERGUARD Model 1 phishing prediction + risk scoring."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .feature_engineering import extract_features
from .inference import PhishingModel

# EVIDENT project root:
# EVIDENT/src/phishing/predict.py -> parents[2] == EVIDENT
PROJECT_DIR = Path(__file__).resolve().parents[2]

MODEL_PATH = PROJECT_DIR / "models" / "phishing" / "phishing_model.pkl"
METADATA_PATH = PROJECT_DIR / "models" / "phishing" / "model_metadata.json"


def predict_url(
    url: str,
    fetch_page: bool = True,
    timeout: int = 8,
) -> dict:
    """
    Run Model 1 and the CYBERGUARD Risk Engine.

    Pipeline:
        URL
          -> feature extraction
          -> Random Forest inference
          -> deterministic risk engine
          -> unified result
    """
    # Import here so src/phishing remains responsible only for
    # Model 1 inference while risk_engine remains an independent layer.
    from risk_engine.scoring import score_prediction

    features = extract_features(
        url,
        fetch_page=fetch_page,
        timeout=timeout,
    )

    predictor = PhishingModel(
        model_path=MODEL_PATH,
        metadata_path=METADATA_PATH,
    )

    model_result = predictor.predict_features(features)

    risk_result = score_prediction({
        "prediction": model_result["prediction"],
        "phishing_probability": model_result.get("phishing_probability", 0.0),
        "features": features,
    })

    # Public response: keep the ML result and risk result together.
    return {
        "url": url,
        "model": {
            "name": model_result["model"],
            "prediction": model_result["prediction"],
            "prediction_class": model_result["prediction_class"],
            "probability": model_result.get("probability"),
            "phishing_probability": model_result.get("phishing_probability"),
            "feature_count": model_result["feature_count"],
        },
        "risk": risk_result,
        "features": features,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="EVIDENT Model 1 phishing + risk analysis"
    )
    parser.add_argument("url", help="URL to analyze")
    parser.add_argument(
        "--no-fetch",
        action="store_true",
        help="Do not fetch the webpage; useful for pipeline testing only.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=8,
        help="HTTP fetch timeout in seconds.",
    )

    args = parser.parse_args()

    result = predict_url(
        args.url,
        fetch_page=not args.no_fetch,
        timeout=args.timeout,
    )

    print(json.dumps(result, indent=2))