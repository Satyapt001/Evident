from typing import Any, Dict, List

from risk_engine.severity import (
    get_severity,
    get_severity_description,
)


TI_SOURCE_WEIGHTS = {
    "OpenPhish": 35.0,
    "PhishTank": 35.0,
    "AlienVault OTX": 20.0,
    "abuse.ch URLhaus": 25.0,
}


def _calculate_threat_intel_score(
    threat_intelligence: Dict[str, Any],
) -> float:
    """
    Calculate the threat-intelligence evidence score.

    Only confirmed positive matches from successfully
    queried providers contribute to the score.
    """

    if not threat_intelligence:
        return 0.0

    sources = threat_intelligence.get("sources", [])

    score = 0.0

    for source in sources:
        if not isinstance(source, dict):
            continue

        # A provider must successfully return a positive match.
        if source.get("status") != "ok":
            continue

        if source.get("found") is not True:
            continue

        source_name = source.get("source", "")

        score += TI_SOURCE_WEIGHTS.get(
            source_name,
            0.0,
        )

    return min(score, 100.0)


def _calculate_indicator_score(
    indicators: List[Dict[str, Any]],
) -> float:
    """
    Calculate the existing rule/evidence score.
    """

    if not indicators:
        return 0.0

    score = 0.0

    for indicator in indicators:
        if not isinstance(indicator, dict):
            continue

        try:
            score += float(indicator.get("weight", 0.0))
        except (TypeError, ValueError):
            continue

    return min(score, 100.0)


def score_prediction(
    result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Calculate the unified CyberGuard risk score.

    Components:

        ML probability
        Rule-based evidence
        Threat-intelligence evidence

    The existing 80/20 model/evidence architecture
    is preserved.
    """

    prediction = str(
        result.get(
            "prediction",
            "unknown",
        )
    ).lower()

    try:
        phishing_probability = float(
            result.get(
                "phishing_probability",
                0.0,
            )
        )
    except (TypeError, ValueError):
        phishing_probability = 0.0

    phishing_probability = max(
        0.0,
        min(
            phishing_probability,
            1.0,
        ),
    )

    threat_intelligence = (
        result.get(
            "threat_intelligence",
            {},
        )
        or {}
    )

    indicators = (
        result.get(
            "indicators",
            [],
        )
        or []
    )

    # Existing rule-based evidence.
    evidence_score = _calculate_indicator_score(indicators)

    # Threat-intelligence evidence.
    threat_intel_score = _calculate_threat_intel_score(threat_intelligence)

    # Use the strongest evidence source to avoid
    # double-counting the same event.
    combined_evidence_score = max(
        evidence_score,
        threat_intel_score,
    )

    # ML contribution.
    model_score = phishing_probability * 100.0

    # Existing 80% ML + 20% evidence architecture.
    risk_score = model_score * 0.80 + combined_evidence_score * 0.20

    risk_score = max(
        0.0,
        min(
            risk_score,
            100.0,
        ),
    )

    # severity.py returns a STRING.
    severity = get_severity(risk_score)

    severity_description = get_severity_description(severity)

    # Preserve existing indicators.
    final_indicators = list(indicators)

    # Add confirmed TI matches as explainable indicators.
    for source in threat_intelligence.get(
        "sources",
        [],
    ):
        if not isinstance(source, dict):
            continue

        if source.get("status") == "ok" and source.get("found") is True:
            source_name = source.get(
                "source",
                "Unknown",
            )

            weight = TI_SOURCE_WEIGHTS.get(
                source_name,
                0.0,
            )

            final_indicators.append(
                {
                    "name": f"TI match: {source_name}",
                    "type": "threat_intelligence",
                    "source": source_name,
                    "description": source.get(
                        "message",
                        f"Positive match from {source_name}.",
                    ),
                    "weight": weight,
                }
            )

    return {
        "prediction": prediction,
        "phishing_probability": round(
            phishing_probability,
            6,
        ),
        "risk_score": round(
            risk_score,
            2,
        ),
        "risk_level": severity,
        "severity_description": (severity_description),
        "model_score": round(
            model_score,
            2,
        ),
        "evidence_score": round(
            evidence_score,
            2,
        ),
        "threat_intel_score": round(
            threat_intel_score,
            2,
        ),
        "indicator_count": len(final_indicators),
        "indicators": final_indicators,
    }


def calculate_risk(
    result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Backward-compatible alias used by
    existing CyberGuard components.
    """

    return score_prediction(result)
