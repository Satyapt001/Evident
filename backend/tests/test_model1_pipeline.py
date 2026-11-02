from risk_engine.rules import evaluate_rules
from risk_engine.scoring import score_prediction
from response_engine.actions import get_action_plan
from response_engine.playbooks import select_playbook
from response_engine.recommendations import generate_recommendations


def test_model1_rule_evidence_is_generated():
    features = {
        "IsDomainIP": 1,
        "HasObfuscation": 1,
        "ObfuscationRatio": 0.10,
        "NoOfSubDomain": 4,
        "NoOfURLRedirect": 2,
        "HasExternalFormSubmit": 1,
        "HasPasswordField": 1,
        "IsHTTPS": 0,
    }
    indicators = evaluate_rules(features)
    names = {item["name"] for item in indicators}
    assert "IP-based domain" in names
    assert "URL obfuscation" in names
    assert "Password field" in names
    assert "External form submission" in names
    assert "No HTTPS" in names


def test_model1_full_risk_response_chain():
    features = {
        "IsDomainIP": 1,
        "HasObfuscation": 1,
        "ObfuscationRatio": 0.10,
        "NoOfSubDomain": 4,
        "NoOfURLRedirect": 2,
        "HasExternalFormSubmit": 1,
        "HasPasswordField": 1,
        "IsHTTPS": 0,
    }
    indicators = evaluate_rules(features)
    ti = {
        "sources": [{
            "source": "OpenPhish", "status": "ok", "found": True,
        }]
    }
    risk = score_prediction({
        "prediction": "phishing",
        "phishing_probability": 0.97,
        "features": features,
        "indicators": indicators,
        "threat_intelligence": ti,
    })
    assert risk["risk_score"] >= 60
    assert risk["risk_level"] in {"HIGH", "CRITICAL"}
    assert risk["indicator_count"] >= len(indicators)
    recommendations = generate_recommendations(risk)
    playbook = select_playbook(risk)
    actions = get_action_plan(risk, recommendations, playbook)
    assert recommendations
    assert playbook["id"] != "NO_INCIDENT"
    assert any(a["action_id"] == "BLOCK_DESTINATION" for a in actions["actions"])
