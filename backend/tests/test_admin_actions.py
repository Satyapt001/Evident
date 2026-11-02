from app.services.incident_store import record_event
from app.services.action_service import available_actions, execute_action


def test_phishing_actions_include_containment_for_high_risk():
    event = record_event({
        "request_id": "req-high",
        "threat_type": "PHISHING",
        "risk_score": 85,
        "risk_level": "CRITICAL",
        "prediction": "phishing",
        "metadata": {"url": "http://evil.example"},
    })
    ids = {a["action_id"] for a in available_actions(event)}
    assert {"BLOCK_URL", "BLOCK_DOMAIN", "QUARANTINE_EVENT", "PRESERVE_EVIDENCE"}.issubset(ids)


def test_approval_gate_prevents_unapproved_containment():
    record_event({
        "request_id": "req-approval",
        "threat_type": "PHISHING",
        "risk_score": 90,
        "risk_level": "CRITICAL",
        "prediction": "phishing",
        "metadata": {"url": "http://evil.example"},
    })
    result = execute_action("req-approval", "BLOCK_URL", False, "", "Admin")
    assert result["status"] == "APPROVAL_REQUIRED"


def test_approved_close_updates_incident():
    record_event({
        "request_id": "req-close",
        "threat_type": "PHISHING",
        "risk_score": 75,
        "risk_level": "HIGH",
        "prediction": "phishing",
    })
    result = execute_action("req-close", "CLOSE_INCIDENT", True, "Reviewed", "Admin")
    assert result["status"] == "EXECUTED"
