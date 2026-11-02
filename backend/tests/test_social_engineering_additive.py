from app.services.social_engineering_service import analyze_social_signals, extract_entities
from app.services.email_action_service import action_plan, execute_action

def test_email_signals_and_entities():
    e = extract_entities("security@bank.example", "URGENT transaction", "Verify your identity at http://192.168.1.10/login")
    assert e["urls"] and e["ip_addresses"]
    score, indicators = analyze_social_signals("security@bank.example", "URGENT", "Your account will be locked. Verify your identity immediately.")
    assert score >= 40
    assert any(x["category"] == "CREDENTIAL_HARVESTING" for x in indicators)

def test_admin_actions_are_risk_aware_and_audited():
    ids = {x["action_id"] for x in action_plan("CRITICAL")}
    assert "QUARANTINE_EMAIL" in ids and "BLOCK_SENDER" in ids
    event = execute_action(request_id="test", action_id="QUARANTINE_EMAIL", analyst="SOC Analyst", risk_level="CRITICAL", approved=True)
    assert event["status"] == "EXECUTED"
