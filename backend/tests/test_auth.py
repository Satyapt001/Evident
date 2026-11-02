import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api.v1.auth import require_user, router as auth_router
from app.core.config import get_settings
from app.services import auth_service


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTH_STORE_PATH", str(tmp_path / "auth.json"))
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    monkeypatch.setenv("AUTH_MAX_FAILED_ATTEMPTS", "3")
    get_settings.cache_clear()
    auth_service._failures.clear()
    app = FastAPI()
    app.include_router(auth_router, prefix="/api/v1")

    @app.get("/api/v1/protected", dependencies=[Depends(require_user)])
    def protected():
        return {"ok": True}

    yield TestClient(app)
    get_settings.cache_clear()


SETUP = {"organization": "Acme SOC", "name": "Asha Rao", "email": "Asha@Acme.io", "password": "Str0ngPassw0rd"}


def test_setup_login_me_and_enforcement(client):
    assert client.get("/api/v1/auth/status").json() == {"initialized": False, "organization": None, "auth_enforced": True}
    assert client.get("/api/v1/protected").status_code == 401

    created = client.post("/api/v1/auth/setup", json=SETUP)
    assert created.status_code == 201
    assert created.json()["user"]["role"] == "admin"
    assert created.json()["user"]["email"] == "asha@acme.io"
    assert client.post("/api/v1/auth/setup", json=SETUP).status_code == 409  # one-time only

    token = client.post("/api/v1/auth/login", json={"email": "ASHA@acme.io", "password": SETUP["password"]}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/protected", headers=headers).json() == {"ok": True}
    assert client.get("/api/v1/auth/me", headers=headers).json()["organization"] == "Acme SOC"
    assert client.get("/api/v1/auth/status").json()["initialized"] is True


def test_tampered_token_is_rejected(client):
    token = client.post("/api/v1/auth/setup", json=SETUP).json()["access_token"]
    head, body, sig = token.split(".")
    forged = ".".join([head, body, sig[:-2] + ("AA" if not sig.endswith("AA") else "BB")])
    assert client.get("/api/v1/protected", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_weak_password_and_bad_login(client):
    weak = client.post("/api/v1/auth/setup", json={**SETUP, "password": "short1"})
    assert weak.status_code == 422
    client.post("/api/v1/auth/setup", json=SETUP)
    bad = client.post("/api/v1/auth/login", json={"email": SETUP["email"], "password": "wrong-password1"})
    assert bad.status_code == 401 and bad.json()["detail"] == "Invalid email or password."
    unknown = client.post("/api/v1/auth/login", json={"email": "nobody@acme.io", "password": "wrong-password1"})
    assert unknown.json()["detail"] == bad.json()["detail"]  # no account enumeration


def test_lockout_after_repeated_failures(client):
    client.post("/api/v1/auth/setup", json=SETUP)
    for _ in range(3):
        client.post("/api/v1/auth/login", json={"email": SETUP["email"], "password": "wrong-password1"})
    locked = client.post("/api/v1/auth/login", json={"email": SETUP["email"], "password": SETUP["password"]})
    assert locked.status_code == 429 and "Retry-After" in locked.headers


def test_admin_can_add_analyst_who_cannot_manage_users(client):
    admin = client.post("/api/v1/auth/setup", json=SETUP).json()["access_token"]
    h = {"Authorization": f"Bearer {admin}"}
    made = client.post("/api/v1/auth/users", headers=h, json={"name": "Ravi K", "email": "ravi@acme.io", "password": "AnalystPass123", "role": "analyst"})
    assert made.status_code == 201
    analyst = client.post("/api/v1/auth/login", json={"email": "ravi@acme.io", "password": "AnalystPass123"}).json()["access_token"]
    assert client.get("/api/v1/auth/users", headers={"Authorization": f"Bearer {analyst}"}).status_code == 403
    assert len(client.get("/api/v1/auth/users", headers=h).json()) == 2


def test_guard_is_inactive_when_not_enforced(client, monkeypatch):
    monkeypatch.setenv("AUTH_REQUIRED", "false")
    get_settings.cache_clear()
    assert client.get("/api/v1/protected").status_code == 200
