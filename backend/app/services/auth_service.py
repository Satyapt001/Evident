"""Security-team authentication for the CYBERGUARD console.

Standard library only (PBKDF2 password hashing, HS256 signed tokens) so the
backend gains no new dependency. Users live in a small JSON file that is
written atomically; it is meant for a single-organisation deployment.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4

from app.core.config import get_settings

_PBKDF2_ITERATIONS = 240_000
_lock = Lock()
_failures: dict[str, list[float]] = {}


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 401, retry_after: int | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.retry_after = retry_after


# ---------- storage ----------
def _store_path() -> Path:
    path = Path(get_settings().auth_store_path)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[2] / path  # relative to the backend folder
    return path


def _load() -> dict[str, Any]:
    path = _store_path()
    if path.is_file():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass
    return {"secret": "", "organization": None, "users": []}


def _save(data: dict[str, Any]) -> None:
    path = _store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    try:
        os.chmod(tmp, 0o600)
    except OSError:
        pass
    os.replace(tmp, path)


def _secret(data: dict[str, Any]) -> bytes:
    configured = get_settings().auth_secret_key.strip()
    if configured:
        return configured.encode()
    if not data.get("secret"):
        data["secret"] = secrets.token_urlsafe(48)
        _save(data)
    return data["secret"].encode()


# ---------- passwords ----------
def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, digest = stored.split("$")
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), _unb64(salt), int(iterations))
        return hmac.compare_digest(candidate, _unb64(digest))
    except (ValueError, TypeError):
        return False


_DUMMY_HASH = hash_password("not-a-real-password-0")  # equalises timing for unknown emails


# ---------- tokens (HS256) ----------
def issue_token(user: dict[str, Any], organization: str, secret: bytes) -> tuple[str, int]:
    ttl = get_settings().auth_token_ttl_minutes * 60
    now = int(time.time())
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    claims = {"sub": user["id"], "role": user["role"], "org": organization, "iat": now, "exp": now + ttl, "jti": uuid4().hex}
    body = _b64(json.dumps(claims, separators=(",", ":")).encode())
    sig = _b64(hmac.new(secret, f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{sig}", ttl


def decode_token(token: str) -> dict[str, Any]:
    try:
        header, body, sig = token.split(".")
        expected = _b64(hmac.new(_secret(_load()), f"{header}.{body}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            raise ValueError("signature")
        claims = json.loads(_unb64(body))
        if int(claims["exp"]) < time.time():
            raise AuthError("Your session has expired. Sign in again.")
        return claims
    except AuthError:
        raise
    except Exception as exc:  # malformed, tampered, wrong key
        raise AuthError("Invalid session token.") from exc


# ---------- helpers ----------
def _public(user: dict[str, Any], organization: str) -> dict[str, Any]:
    return {k: user.get(k) for k in ("id", "name", "email", "role", "created_at", "last_login")} | {"organization": organization}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def status() -> dict[str, Any]:
    with _lock:
        data = _load()
    org = (data.get("organization") or {}).get("name")
    return {"initialized": bool(data["users"]), "organization": org, "auth_enforced": get_settings().auth_required}


def _login_response(user: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    org = data["organization"]["name"]
    token, ttl = issue_token(user, org, _secret(data))
    return {"access_token": token, "token_type": "bearer", "expires_in": ttl, "user": _public(user, org)}


# ---------- operations ----------
def setup(organization: str, name: str, email: str, password: str) -> dict[str, Any]:
    with _lock:
        data = _load()
        if data["users"]:
            raise AuthError("This console is already set up. Sign in instead.", 409)
        user = {"id": uuid4().hex, "name": name.strip(), "email": email, "role": "admin",
                "password_hash": hash_password(password), "created_at": _now(), "last_login": _now()}
        data["organization"] = {"name": organization.strip(), "created_at": _now()}
        data["users"] = [user]
        _secret(data)
        _save(data)
        return _login_response(user, data)


def _throttle_keys(email: str, client: str) -> list[str]:
    return [f"email:{email}", f"ip:{client}"]


def _check_lockout(keys: list[str]) -> None:
    settings = get_settings()
    window = settings.auth_lockout_minutes * 60
    now = time.time()
    for key in keys:
        recent = [t for t in _failures.get(key, []) if now - t < window]
        _failures[key] = recent
        if len(recent) >= settings.auth_max_failed_attempts:
            wait = int(window - (now - recent[0])) + 1
            raise AuthError(f"Too many failed sign-in attempts. Try again in {max(1, wait // 60)} min.", 429, wait)


def login(email: str, password: str, client: str = "unknown") -> dict[str, Any]:
    keys = _throttle_keys(email, client)
    with _lock:
        _check_lockout(keys)
        data = _load()
        user = next((u for u in data["users"] if u["email"] == email), None)
        ok = verify_password(password, user["password_hash"] if user else _DUMMY_HASH)
        if not user or not ok:
            for key in keys:
                _failures.setdefault(key, []).append(time.time())
            raise AuthError("Invalid email or password.")
        for key in keys:
            _failures.pop(key, None)
        user["last_login"] = _now()
        _save(data)
        return _login_response(user, data)


def user_from_claims(claims: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        data = _load()
    user = next((u for u in data["users"] if u["id"] == claims.get("sub")), None)
    if not user:
        raise AuthError("This account no longer exists.")
    return _public(user, data["organization"]["name"])


def list_users() -> list[dict[str, Any]]:
    with _lock:
        data = _load()
    org = data["organization"]["name"] if data.get("organization") else ""
    return [_public(u, org) for u in data["users"]]


def create_user(name: str, email: str, password: str, role: str) -> dict[str, Any]:
    with _lock:
        data = _load()
        if any(u["email"] == email for u in data["users"]):
            raise AuthError("A user with this email already exists.", 409)
        user = {"id": uuid4().hex, "name": name.strip(), "email": email, "role": role,
                "password_hash": hash_password(password), "created_at": _now(), "last_login": None}
        data["users"].append(user)
        _save(data)
        return _public(user, data["organization"]["name"])
