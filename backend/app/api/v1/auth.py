"""Sign-in endpoints for the security-team console."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.schemas.auth import (
    AuthStatus, CreateUserRequest, LoginRequest, SetupRequest, TokenResponse, UserPublic,
)
from app.services import auth_service as svc

router = APIRouter(prefix="/auth", tags=["Authentication"])
_bearer = HTTPBearer(auto_error=False)


def _fail(exc: svc.AuthError) -> HTTPException:
    headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else {}
    if exc.retry_after:
        headers["Retry-After"] = str(exc.retry_after)
    return HTTPException(status_code=exc.status_code, detail=exc.message, headers=headers or None)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    if creds is None:
        raise _fail(svc.AuthError("Sign in to continue."))
    try:
        return svc.user_from_claims(svc.decode_token(creds.credentials))
    except svc.AuthError as exc:
        raise _fail(exc) from exc


def require_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict | None:
    """Router-level guard. Does nothing unless AUTH_REQUIRED=true."""
    if not get_settings().auth_required:
        return None
    return current_user(creds)


def require_admin(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrator access is required.")
    return user


@router.get("/status", response_model=AuthStatus)
def auth_status():
    return svc.status()


@router.post("/setup", response_model=TokenResponse, status_code=201)
def setup(payload: SetupRequest):
    try:
        return svc.setup(payload.organization, payload.name, payload.email, payload.password)
    except svc.AuthError as exc:
        raise _fail(exc) from exc


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request):
    client = request.client.host if request.client else "unknown"
    try:
        return svc.login(payload.email, payload.password, client)
    except svc.AuthError as exc:
        raise _fail(exc) from exc


@router.get("/me", response_model=UserPublic)
def me(user: dict = Depends(current_user)):
    return user


@router.post("/logout")
def logout(_: dict = Depends(current_user)):
    # Tokens are stateless; the console discards its copy. Kept as an endpoint so
    # sign-outs have a single place to be audited later.
    return {"status": "signed_out"}


@router.get("/users", response_model=list[UserPublic])
def users(_: dict = Depends(require_admin)):
    return svc.list_users()


@router.post("/users", response_model=UserPublic, status_code=201)
def add_user(payload: CreateUserRequest, _: dict = Depends(require_admin)):
    try:
        return svc.create_user(payload.name, payload.email, payload.password, payload.role)
    except svc.AuthError as exc:
        raise _fail(exc) from exc
