"""CYBERGUARD DeepGuard risk scoring.

The detector probability is the primary signal. It must not be copied into
an independent evidence score and counted twice.
"""
from typing import Any
from risk_engine.severity import get_severity


def calculate_deepfake_risk(class_1_probability: float, indicators: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    try:
        probability = float(class_1_probability)
    except (TypeError, ValueError):
        probability = 0.0
    probability = max(0.0, min(probability, 1.0))
    model_score = probability * 100.0

    clean = []
    evidence_score = 0.0
    for indicator in indicators or []:
        if not isinstance(indicator, dict):
            continue
        try:
            points = float(indicator.get("points", 0.0))
        except (TypeError, ValueError):
            points = 0.0
        points = max(0.0, min(points, 100.0))
        item = dict(indicator)
        item["points"] = round(points, 2)
        clean.append(item)
        evidence_score += points

    evidence_score = min(evidence_score, 100.0)
    risk_score = max(0.0, min(model_score * 0.80 + evidence_score * 0.20, 100.0))
    severity = get_severity(risk_score)
    descriptions = {
        "SAFE": "No significant deepfake risk was identified by the model.",
        "LOW": "Limited evidence of possible synthetic or manipulated media.",
        "MEDIUM": "The media shows suspicious characteristics and requires caution.",
        "HIGH": "Strong evidence suggests the media may be synthetically manipulated.",
        "CRITICAL": "Very strong evidence that the media may be synthetically manipulated or deepfake-generated.",
    }
    return {
        "risk_score": round(risk_score, 2),
        "risk_level": severity,
        "severity_description": descriptions.get(severity, "Unknown severity."),
        "model_score": round(model_score, 2),
        "evidence_score": round(evidence_score, 2),
        "indicator_count": len(clean),
        "indicators": clean,
    }


def build_probability_indicator(class_1_probability: float) -> dict[str, Any]:
    try:
        percentage = max(0.0, min(float(class_1_probability), 1.0)) * 100.0
    except (TypeError, ValueError):
        percentage = 0.0
    if percentage < 20.0:
        return {}
    return {
        "name": "High deepfake probability",
        "reason": f"The DF40 CLIP detector assigned {percentage:.2f}% probability to the fake class.",
        "points": round(percentage, 2),
    }
