from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class IncidentEvent(BaseModel):
    request_id: str
    threat_type: str
    risk_score: float = Field(ge=0, le=100)
    risk_level: str
    confidence: float | None = Field(default=None, ge=0, le=1)
    explanation: str = ""
    indicators: list[dict[str, Any]] = Field(default_factory=list)
    source: str = "unknown"
    metadata: dict[str, Any] = Field(default_factory=dict)

    # Server-generated fields used by the SOC dashboard.
    event_id: str | None = None
    timestamp: str | None = None
    status: str = "OPEN"


class IncidentResponse(BaseModel):
    stored: bool
    incident: IncidentEvent


class DashboardResponse(BaseModel):
    total_events: int
    threats_detected: int
    critical_events: int
    active_incidents: int
    risk_distribution: dict[str, int]
    threat_distribution: dict[str, int]
    timeline: list[dict[str, Any]]
    recent_events: list[IncidentEvent]
    generated_at: str
