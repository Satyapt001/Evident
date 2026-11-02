from __future__ import annotations

from uuid import uuid4

from risk_engine.behavior import score_behavior_prediction
from response_engine.behavior import build_behavior_response
from src.behavior.inference import predict_network_flow


class BehaviorAnalysisService:
    """
    Adapter between the existing Model 3 network-flow inference contract
    and the backend risk/response contract.

    The production model returns ``attack_family`` while the risk engine
    expects ``attack_category``. This service normalizes that naming without
    changing the trained model or its inference implementation.
    """

    def analyze(self, event: dict) -> dict:
        # Use the existing production Model 3 inference function.
        result = predict_network_flow(event)

        # Normalize the model output for the existing risk engine.
        prediction = {
            "attack_probability": result["attack_probability"],
            "attack_category": result.get("attack_family", "OTHER_ATTACK"),
        }

        risk = score_behavior_prediction(prediction)

        threat_type = prediction["attack_category"]
        confidence = float(result["attack_probability"])

        if threat_type == "BENIGN":
            threat_type = "NORMAL"

        if threat_type == "NORMAL":
            explanation = "No significant behavioral anomaly was identified."
        else:
            names = ", ".join(item["name"] for item in risk["indicators"])
            explanation = (
                f"{risk['risk_level']} risk behavioral assessment: "
                f"{threat_type.replace('_', ' ').title()}. "
                f"Key indicators: {names}."
            )

        return {
            "request_id": str(uuid4()),
            "model": result["model"],
            "threat_type": threat_type,
            "confidence": confidence,
            "risk": risk,
            "explanation": explanation,
            "response": build_behavior_response(
                threat_type,
                risk["risk_level"],
            ),
        }
