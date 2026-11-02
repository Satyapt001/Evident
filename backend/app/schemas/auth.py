from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Role = Literal["admin", "analyst"]


def _check_password(value: str) -> str:
    if len(value) < 10:
        raise ValueError("Password must be at least 10 characters.")
    if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
        raise ValueError("Password must contain at least one letter and one number.")
    return value


def _check_email(value: str) -> str:
    value = value.strip().lower()
    local, _, domain = value.partition("@")
    if not local or "." not in domain or " " in value:
        raise ValueError("Enter a valid work email address.")
    return value


class SetupRequest(BaseModel):
    organization: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=80)
    email: str
    password: str

    _email = field_validator("email")(_check_email)
    _password = field_validator("password")(_check_password)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def _norm(cls, value: str) -> str:
        return value.strip().lower()


class CreateUserRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str
    password: str
    role: Role = "analyst"

    _email = field_validator("email")(_check_email)
    _password = field_validator("password")(_check_password)


class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    role: Role
    organization: str
    created_at: str
    last_login: str | None = None


class AuthStatus(BaseModel):
    initialized: bool
    organization: str | None = None
    auth_enforced: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserPublic
