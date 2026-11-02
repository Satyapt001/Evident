"""Application service for Model 1 phishing analysis plus TI enrichment.

URL page retrieval is best-effort: if a destination blocks automated requests,
has a TLS problem, or times out, the pipeline still evaluates URL-only features
and clearly marks that limitation in the response. The model input feature
schema remains unchanged.
"""
from pathlib import Path

import requests

from src.phishing.feature_engineering import extract_features
from src.phishing.inference import PhishingModel
from threat_intelligence import ThreatIntelService

from risk_engine.rules import evaluate_rules
from risk_engine.scoring import score_prediction
from response_engine.recommendations import generate_recommendations
from response_engine.playbooks import select_playbook
from response_engine.actions import get_action_plan


class PhishingAnalysisService:
    """Coordinates Model 1, Threat Intelligence, Risk, and Response engines."""

    def __init__(self, model_path: str, metadata_path: str):
        self.predictor = PhishingModel(
            model_path=Path(model_path),
            metadata_path=Path(metadata_path),
        )
        self.threat_intel = ThreatIntelService()

    def analyze(
        self,
        url: str,
        fetch_page: bool = True,
        timeout: int = 8,
    ) -> dict:
        fetch_status = "not_requested"
        fetch_warning = None

        if fetch_page:
            try:
                features = extract_features(
                    url,
                    fetch_page=True,
                    timeout=timeout,
                )
                fetch_status = "complete"
            except requests.RequestException as exc:
                # Preserve URL-level detection when a site is unavailable to
                # the scanner. Do not silently represent failed page features
                # as if they had been collected.
                features = extract_features(url, fetch_page=False, timeout=timeout)
                fetch_status = "url_only_fallback"
                fetch_warning = (
                    f"The page could not be fetched ({type(exc).__name__}). "
                    "Prediction used URL-only features; page-content indicators were unavailable."
                )
        else:
            features = extract_features(url, fetch_page=False, timeout=timeout)
            fetch_status = "url_only"

        model_result = self.predictor.predict_features(features)
        rule_indicators = evaluate_rules(features)
        ti_result = self.threat_intel.lookup_url(url)
        ti_dict = ti_result.to_dict()

        risk_result = score_prediction({
            "prediction": model_result["prediction"],
            "phishing_probability": model_result.get("phishing_probability", 0.0),
            "features": features,
            "indicators": rule_indicators,
            "threat_intelligence": ti_dict,
        })

        recommendations = generate_recommendations(risk_result)
        playbook = select_playbook(risk_result)
        action_plan = get_action_plan(risk_result, recommendations, playbook)

        # These diagnostic keys are added only after inference and scoring, so
        # they never enter the model's expected feature vector.
        response_features = dict(features)
        response_features["_page_fetch_status"] = fetch_status
        if fetch_warning:
            response_features["_page_fetch_warning"] = fetch_warning

        return {
            "model": {
                "name": model_result["model"],
                "prediction": model_result["prediction"],
                "prediction_class": model_result["prediction_class"],
                "probability": model_result.get("probability"),
                "phishing_probability": model_result.get("phishing_probability"),
                "feature_count": model_result["feature_count"],
            },
            "threat_intelligence": ti_dict,
            "risk": risk_result,
            "response": {
                "mode": action_plan["mode"],
                "recommendations": recommendations,
                "playbook": playbook,
                "actions": action_plan["actions"],
            },
            "features": response_features,
        }
