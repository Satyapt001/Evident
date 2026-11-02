def test_category_weights():
    from risk_engine.behavior import score_behavior_prediction
    r = score_behavior_prediction({"attack_probability": 0.9, "attack_category": "DOS_DDOS"})
    assert r["risk_level"] in {"MEDIUM", "HIGH", "CRITICAL"}
    assert 0 <= r["risk_score"] <= 100

def test_response_is_non_destructive():
    from response_engine.behavior import recommendations
    assert all("delete" not in x.lower() and "destroy" not in x.lower() for x in recommendations("PORT_SCAN","HIGH"))
