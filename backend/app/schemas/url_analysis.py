"""Pydantic contracts for URL analysis.

The Indicator validator accepts both the public contract (reason/points) and
the internal threat-intelligence shape (description/weight). This keeps the
existing Model 1 risk pipeline unchanged while preventing a response-level
422 when an internal TI indicator has not yet been normalized.
"""
from typing import Any
from pydantic import BaseModel, Field, HttpUrl, model_validator


class URLAnalyzeRequest(BaseModel):
    url: HttpUrl
    fetch_page: bool = True
    timeout: int = Field(default=8, ge=1, le=15)


class ModelResult(BaseModel):
    name: str
    prediction: str
    prediction_class: int
    probability: float | None = None
    phishing_probability: float | None = None
    feature_count: int


class Indicator(BaseModel):
    name: str
    reason: str
    points: float

    @model_validator(mode="before")
    @classmethod
    def normalize_internal_indicator(cls, value: Any):
        if not isinstance(value, dict):
            return value
        item = dict(value)
        if not item.get("reason") and item.get("description") is not None:
            item["reason"] = item["description"]
        if item.get("points") is None and item.get("weight") is not None:
            item["points"] = item["weight"]
        return item


class RiskResult(BaseModel):
    prediction: str
    phishing_probability: float
    risk_score: float
    risk_level: str
    severity_description: str
    model_score: float
    evidence_score: float
    threat_intel_score: float = 0.0
    indicator_count: int
    indicators: list[Indicator]


class ThreatIntelSource(BaseModel):
    source: str
    status: str
    found: bool = False
    confidence: str = "unknown"
    category: str | None = None
    message: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ThreatIntelResult(BaseModel):
    indicator: str
    indicator_type: str = "url"
    found: bool = False
    malicious: bool = False
    sources_checked: int
    positive_sources: int
    sources: list[ThreatIntelSource]


class Recommendation(BaseModel):
    priority: str
    action: str
    reason: str


class Playbook(BaseModel):
    id: str
    name: str
    objective: str
    steps: list[str]


class ResponseAction(BaseModel):
    action_id: str
    name: str
    type: str
    priority: str
    requires_approval: bool
    status: str


class ResponseResult(BaseModel):
    mode: str
    incident_id: str | None = None
    recommendations: list[Recommendation]
    playbook: Playbook
    actions: list[ResponseAction]


class URLAnalyzeResponse(BaseModel):
    request_id: str
    url: str
    model: ModelResult
    threat_intelligence: ThreatIntelResult
    risk: RiskResult
    response: ResponseResult
    features: dict[str, Any]
