"""Pydantic contracts for DeepGuard media authenticity analysis."""
from pydantic import BaseModel, Field


class DeepfakeModelResult(BaseModel):
    name: str
    technical_name: str
    predicted_class: int
    predicted_label: str
    class_probabilities: list[float] = Field(min_length=2, max_length=2)
    class_1_probability: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    probability_margin: float | None = Field(default=None, ge=0.0, le=1.0)
    prediction_entropy: float | None = Field(default=None, ge=0.0)
    logits: list[float]
    device: str
    checkpoint: str | None = None


class DeepfakeIndicator(BaseModel):
    name: str
    reason: str
    points: float


class DeepfakeRiskResult(BaseModel):
    risk_score: float
    risk_level: str
    severity_description: str
    model_score: float
    evidence_score: float
    indicator_count: int
    indicators: list[DeepfakeIndicator]


class DeepfakeResponseAction(BaseModel):
    action: str
    type: str
    destructive: bool


class DeepfakePlaybook(BaseModel):
    name: str
    description: str


class DeepfakeResponseResult(BaseModel):
    mode: str
    recommendations: list[str]
    playbook: DeepfakePlaybook
    actions: list[DeepfakeResponseAction]


class DeepfakeMediaMetadata(BaseModel):
    format: str
    width: int
    height: int
    color_mode: str
    size_bytes: int
    sha256: str


class DeepfakeEvidence(BaseModel):
    name: str
    value: float | str
    unit: str
    interpretation: str


class DeepfakeAnalyzeResponse(BaseModel):
    request_id: str
    filename: str
    model: DeepfakeModelResult
    risk: DeepfakeRiskResult
    response: DeepfakeResponseResult
    media: DeepfakeMediaMetadata
    analysis_evidence: list[DeepfakeEvidence]
