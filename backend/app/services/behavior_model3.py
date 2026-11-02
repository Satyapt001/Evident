"""Model 3 network-flow inference adapter."""
from __future__ import annotations

from typing import Any

from response_engine.behavior import build_behavior_response
from risk_engine.behavior import score_behavior_prediction
from src.behavior.inference import predict_network_flow


def _as_float(flow: dict[str, Any], key: str) -> float | None:
    value = flow.get(key)
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _build_explanation(model: dict[str, Any], risk: dict[str, Any], flow: dict[str, Any]) -> str:
    family = str(model.get("attack_family", "BENIGN"))
    probability = float(model.get("attack_probability", 0.0))

    if family == "BENIGN":
        return (
            f"Model 3 classified the supplied flow as BENIGN with "
            f"{(1.0 - probability) * 100:.2f}% benign confidence. "
            "No model-level attack evidence crossed the attack threshold."
        )

    evidence = [item["name"] for item in risk.get("indicators", []) if item.get("name")]
    evidence_text = ", ".join(evidence[:3]) if evidence else "the trained network-flow pattern"
    return (
        f"Model 3 classified the flow as {family.replace('_', ' ')} with "
        f"{probability * 100:.2f}% attack probability. "
        f"Primary evidence: {evidence_text}."
    )


def analyze_network_flow(
    flow: dict[str, Any],
    *,
    request_id: str,
    source_ip: str | None = None,
    destination_ip: str | None = None,
    source_port: int | None = None,
    destination_port: int | None = None,
) -> dict[str, Any]:
    # Only ``flow`` enters the trained model. Endpoint identifiers remain in
    # the control-plane context and never alter the learned feature vector.
    model = predict_network_flow(flow)
    prediction = {
        "attack_probability": model["attack_probability"],
        "attack_category": model.get("attack_family", "OTHER_ATTACK"),
    }

    risk = score_behavior_prediction(prediction, flow=flow)
    threat_type = prediction["attack_category"]
    response = build_behavior_response(threat_type, risk["risk_level"])

    return {
        "request_id": request_id,
        "model": model,
        "threat_type": threat_type,
        "confidence": float(model["attack_probability"]),
        "risk": risk,
        "explanation": _build_explanation(model, risk, flow),
        "context": {
            "source_ip": source_ip,
            "destination_ip": destination_ip,
            "source_port": source_port,
            "destination_port": destination_port,
        },
        "response": response,
    }
