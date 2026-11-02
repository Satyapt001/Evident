from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.v1.incidents import router

def test_incident_and_dashboard_contract():
    app = FastAPI(); app.include_router(router, prefix="/api/v1")
    client = TestClient(app)
    r = client.post("/api/v1/incidents", json={
        "request_id":"demo-1","threat_type":"ACCOUNT_TAKEOVER","risk_score":86.5,
        "risk_level":"CRITICAL","confidence":0.91,"explanation":"Suspicious login behavior",
        "indicators":[{"name":"Unknown device","points":20}],"source":"behavior"
    })
    assert r.status_code == 200 and r.json()["stored"] is True
    d = client.get("/api/v1/incidents/dashboard")
    assert d.status_code == 200
    assert d.json()["total_events"] >= 1
    assert d.json()["threat_distribution"]["ACCOUNT_TAKEOVER"] >= 1
