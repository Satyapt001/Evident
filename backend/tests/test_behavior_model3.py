from src.behavior.inference import analyze_event
from risk_engine.behavior import calculate_behavior_risk
from response_engine.behavior import build_behavior_response


def test_normal_event_is_safe():
    result = analyze_event({
        "failed_logins": 0,
        "successful_logins": 2,
    })
    assert result["threat_type"] == "NORMAL"
    assert result["risk_score"] < 20


def test_bruteforce_is_detected():
    result = analyze_event({
        "failed_logins": 12,
        "successful_logins": 1,
        "source_ip": "203.0.113.10",
    })
    assert result["threat_type"] == "BRUTE_FORCE"
    assert result["risk_score"] >= 20
    assert result["indicators"]


def test_account_takeover_is_detected():
    result = analyze_event({
        "failed_logins": 10,
        "successful_logins": 1,
        "new_device": True,
        "unusual_location": True,
    })
    assert result["threat_type"] == "ACCOUNT_TAKEOVER"


def test_api_abuse_is_detected():
    result = analyze_event({
        "requests_per_minute": 180,
        "failed_requests": 25,
    })
    assert result["threat_type"] == "API_ABUSE"


def test_risk_contract():
    result = calculate_behavior_risk(86.5, [{"name": "test", "points": 30}])
    assert result["risk_score"] == 86.5
    assert result["risk_level"] == "CRITICAL"
    assert result["indicator_count"] == 1


def test_response_is_recommendation_only():
    response = build_behavior_response("ACCOUNT_TAKEOVER", "CRITICAL")
    assert response["mode"] == "RECOMMENDATION_ONLY"
    assert all(not x["destructive"] for x in response["actions"])
