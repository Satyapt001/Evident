from risk_engine.scoring import score_prediction
from response_engine.actions import get_action_plan
from response_engine.playbooks import select_playbook
from response_engine.recommendations import generate_recommendations


def test_positive_ti_match_propagates_through_risk_and_response():
    ti = {
        "indicator": "https://test.invalid/ioc",
        "indicator_type": "url",
        "found": True,
        "malicious": True,
        "sources_checked": 4,
        "positive_sources": 1,
        "sources": [
            {
                "source": "OpenPhish",
                "status": "ok",
                "found": True,
                "confidence": "high",
                "category": "phishing",
                "message": "URL present in OpenPhish feed.",
                "metadata": {},
            }
        ],
    }

    risk = score_prediction(
        {
            "prediction": "legitimate",
            "phishing_probability": 0.01,
            "features": {},
            "threat_intelligence": ti,
        }
    )

    assert risk["threat_intel_score"] == 35.0
    assert risk["indicator_count"] == 1
    assert risk["indicators"][0]["name"] == "TI match: OpenPhish"

    recommendations = generate_recommendations(risk)
    playbook = select_playbook(risk)
    actions = get_action_plan(risk, recommendations, playbook)

    assert risk["risk_score"] > 0
    assert recommendations
    assert playbook
    assert actions["actions"]
