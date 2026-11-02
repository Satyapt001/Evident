"""Combine Model 1 probability with deterministic evidence."""

def calculate_model_score(phishing_probability: float) -> float:
    """Convert phishing probability [0,1] into a 0-100 score."""
    return max(0.0, min(100.0, float(phishing_probability) * 100.0))


def calculate_evidence_score(indicators: list[dict]) -> float:
    """Convert rule points into a bounded 0-100 evidence score."""
    points = sum(float(item["points"]) for item in indicators)
    max_points = 100.0
    return min(100.0, (points / max_points) * 100.0)


def correlate(phishing_probability: float, indicators: list[dict]) -> dict:
    """
    Correlate ML probability and deterministic evidence.

    The ML model is the primary signal; deterministic evidence provides
    bounded contextual support.
    """
    model_score = calculate_model_score(phishing_probability)
    evidence_score = calculate_evidence_score(indicators)

    risk_score = (model_score * 0.80) + (evidence_score * 0.20)

    return {
        "model_score": round(model_score, 2),
        "evidence_score": round(evidence_score, 2),
        "risk_score": round(min(100.0, risk_score), 2),
    }
