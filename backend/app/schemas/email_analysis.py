from typing import Any
from pydantic import BaseModel, Field


class EmailAnalyzeRequest(BaseModel):
    sender: str = ""
    subject: str = ""
    body: str = ""
    analyze_urls: bool = True


class SocialIndicator(BaseModel):
    name: str
    category: str
    reason: str
    points: float
    evidence: str = ""


class ExtractedEntities(BaseModel):
    urls: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)
    ip_addresses: list[str] = Field(default_factory=list)
    email_addresses: list[str] = Field(default_factory=list)


class EmailURLResult(BaseModel):
    url: str
    prediction: str
    phishing_probability: float | None = None
    risk_score: float | None = None
    risk_level: str
    threat_intelligence_matches: int = 0
    error: str | None = None


class EmailRecommendation(BaseModel):
    priority: str
    action: str
    reason: str


class EmailAnalysisResponse(BaseModel):
    request_id: str
    incident_id: str
    risk_score: float
    risk_level: str
    verdict: str
    confidence: float | None = None
    social_engineering_score: float
    explanation: str
    indicators: list[SocialIndicator]
    entities: ExtractedEntities
    url_results: list[EmailURLResult]
    recommendations: list[EmailRecommendation]

