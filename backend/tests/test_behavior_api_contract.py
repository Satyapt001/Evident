from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.behavior_analysis import router


def test_behavior_endpoint_contract():
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    client = TestClient(app)

    response = client.post(
        "/api/v1/analyze/behavior",
        json={
            "username": "demo",
            "failed_logins": 12,
            "successful_logins": 1,
            "new_device": True,
            "unusual_location": True,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["threat_type"] == "ACCOUNT_TAKEOVER"
    assert body["risk"]["risk_level"] in {
        "SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL"
    }
    assert body["response"]["mode"] == "RECOMMENDATION_ONLY"
