from __future__ import annotations

from pydantic import BaseModel, Field


class BehaviorEvent(BaseModel):
    username: str = "unknown"
    source_ip: str = "unknown"
    device_id: str = "unknown"
    country: str = "unknown"
    event_type: str = "authentication"

    failed_logins: float = Field(0, ge=0)
    successful_logins: float = Field(0, ge=0)
    requests_per_minute: float = Field(0, ge=0)
    failed_requests: float = Field(0, ge=0)
    session_duration_minutes: float = Field(0, ge=0)

    new_device: bool = False
    unusual_location: bool = False
    unusual_time: bool = False
    privilege_change: bool = False


class BehaviorAnalyzeResponse(BaseModel):
    request_id: str
    model: str
    threat_type: str
    confidence: float
    risk: dict
    explanation: str
    response: dict
