from app.services.social_engineering_service import analyze_social_signals, extract_entities


def test_extracts_email_url_and_ip():
    entities = extract_entities(
        "security@example.com",
        "Urgent verification",
        "Visit http://192.168.1.10:8080/login now.",
    )
    assert "http://192.168.1.10:8080/login" in entities["urls"]
    assert "192.168.1.10" in entities["ip_addresses"]
    assert "security@example.com" in entities["email_addresses"]


def test_social_engineering_rules_are_explainable():
    score, indicators = analyze_social_signals(
        "security@bank-verification.com",
        "URGENT unauthorized transaction",
        "Your account will be locked. Verify your identity immediately.",
    )
    assert score > 0
    assert any(x["category"] == "URGENCY" for x in indicators)
    assert any(x["category"] == "CREDENTIAL_HARVESTING" for x in indicators)
