from app.schemas.url_analysis import ThreatIntelResult, URLAnalyzeResponse


def test_threat_intel_schema():
    result = ThreatIntelResult(
        indicator="https://example.com/",
        sources_checked=4,
        positive_sources=1,
        sources=[
            {
                "source": "OpenPhish",
                "status": "ok",
                "found": True,
                "confidence": "high",
                "category": "phishing",
            }
        ],
    )

    assert result.found is True
    assert result.positive_sources == 1


def test_response_schema_accepts_ti_and_risk_score():
    response = URLAnalyzeResponse(
        request_id="test",
        url="https://example.com/",
        model={
            "name": "Random Forest",
            "prediction": "legitimate",
            "prediction_class": 0,
            "probability": 0.99,
            "phishing_probability": 0.01,
            "feature_count": 50,
        },
        threat_intelligence={
            "indicator": "https://example.com/",
            "sources_checked": 4,
            "positive_sources": 0,
            "sources": [],
        },
        risk={
            "prediction": "legitimate",
            "phishing_probability": 0.01,
            "risk_score": 0.8,
            "risk_level": "SAFE",
            "severity_description": "No significant phishing risk identified.",
            "model_score": 1.0,
            "evidence_score": 0.0,
            "indicator_count": 0,
            "indicators": [],
        },
        response={
            "mode": "RECOMMEND_ONLY",
            "recommendations": [],
            "playbook": {
                "id": "NO_INCIDENT",
                "name": "No Phishing Incident",
                "objective": "No incident",
                "steps": [],
            },
            "actions": [],
        },
        features={"URLLength": 20},
    )

    assert response.threat_intelligence.sources_checked == 4
