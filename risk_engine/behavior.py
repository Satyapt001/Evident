"""CYBERGUARD Model 3 risk, evidence and severity."""
from __future__ import annotations

from typing import Any

from risk_engine.severity import get_severity


DESCRIPTIONS = {
    "SAFE": "No significant behavioral threat identified.",
    "LOW": "Limited behavioral anomalies detected.",
    "MEDIUM": "Suspicious behavioral activity requires review.",
    "HIGH": "Strong behavioral indicators suggest a potential cyber threat.",
    "CRITICAL": "Very strong behavioral indicators suggest an active or high-impact cyber threat.",
}


def _number(flow: dict[str, Any], key: str) -> float | None:
    value = flow.get(key)
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def build_behavior_indicators(
    prediction: dict[str, Any],
    flow: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """Produce evidence from the actual supplied flow without changing model risk.

    These are explanatory signals only. The risk score remains the trained
    model probability, preventing rule heuristics from silently overriding the
    production classifier.
    """
    flow = flow or {}
    probability = max(0.0, min(float(prediction.get("attack_probability", 0.0)), 1.0))
    category = str(prediction.get("attack_category", "OTHER_ATTACK")).upper()
    indicators: list[dict[str, Any]] = []

    if probability >= 0.5 and category != "BENIGN":
        indicators.append({
            "name": f"Model 3 detection: {category}",
            "reason": f"The trained network threat model estimated {probability:.2%} attack probability.",
            "points": round(probability * 100, 2),
            "impact": "MODEL",
        })

    duration = _number(flow, "Flow Duration")
    total_fwd = _number(flow, "Total Fwd Packets")
    total_bwd = _number(flow, "Total Backward Packets")
    packet_rate = _number(flow, "Flow Packets/s")
    syn = _number(flow, "SYN Flag Count")
    ack = _number(flow, "ACK Flag Count")
    fwd_bytes = _number(flow, "Total Length of Fwd Packets")
    bwd_bytes = _number(flow, "Total Length of Bwd Packets")
    dst_port = _number(flow, "Destination Port")

    if duration is not None and total_fwd is not None and total_bwd is not None:
        if duration < 1000 and total_fwd + total_bwd <= 4:
            indicators.append({
                "name": "Short low-volume flow",
                "reason": f"Flow duration is {duration:.0f} µs with only {total_fwd + total_bwd:.0f} packets.",
                "points": 10,
                "impact": "SUPPORTING",
            })

    if packet_rate is not None and packet_rate >= 10000:
        indicators.append({
            "name": "Very high packet rate",
            "reason": f"Observed flow packet rate is {packet_rate:,.2f} packets/s.",
            "points": 15,
            "impact": "SUPPORTING",
        })

    if syn is not None and syn >= 5 and (ack is None or ack <= max(1.0, syn * 0.1)):
        indicators.append({
            "name": "SYN-heavy traffic",
            "reason": f"SYN flag count is {syn:.0f} while ACK count is {0 if ack is None else ack:.0f}.",
            "points": 15,
            "impact": "SUPPORTING",
        })

    if fwd_bytes is not None and bwd_bytes is not None and fwd_bytes > 0 and bwd_bytes >= fwd_bytes * 5:
        indicators.append({
            "name": "Strong forward/backward byte asymmetry",
            "reason": f"Backward bytes ({bwd_bytes:,.0f}) are substantially higher than forward bytes ({fwd_bytes:,.0f}).",
            "points": 10,
            "impact": "SUPPORTING",
        })

    if dst_port == 22 and total_fwd is not None and total_fwd >= 10:
        indicators.append({
            "name": "Repeated SSH service activity",
            "reason": f"The flow targets TCP/22 with {total_fwd:.0f} forward packets.",
            "points": 10,
            "impact": "SUPPORTING",
        })

    return indicators


def calculate_behavior_risk(
    risk_score: float,
    indicators: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    score = max(0.0, min(float(risk_score), 100.0))
    clean = [dict(x) for x in (indicators or []) if isinstance(x, dict)]
    severity = get_severity(score)
    return {
        "risk_score": round(score, 2),
        "risk_level": severity,
        "severity_description": DESCRIPTIONS.get(severity, "Unknown severity."),
        "indicator_count": len(clean),
        "indicators": clean,
    }


def score_behavior_prediction(
    prediction: dict[str, Any],
    flow: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Score Model 3 directly; evidence never adds to the model probability."""
    probability = max(0.0, min(float(prediction.get("attack_probability", 0.0)), 1.0))
    score = probability * 100.0
    indicators = build_behavior_indicators(prediction, flow)
    return calculate_behavior_risk(score, indicators)
