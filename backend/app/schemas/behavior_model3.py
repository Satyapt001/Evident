from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class NetworkFlowAnalysisRequest(BaseModel):
    """Model 3 input.

    ``flow`` contains only the trained numeric CICIDS2017 features. Endpoint
    context is kept outside the model vector so it can safely be used by the
    response/control plane without changing the trained artifact.
    """

    flow: dict[str, Any] = Field(
        ...,
        min_length=1,
        description="CICIDS2017-compatible network flow feature object",
    )
    source_ip: str | None = Field(default=None, description="Observed source IP for analyst response actions")
    destination_ip: str | None = Field(default=None, description="Observed destination IP for analyst context")
    source_port: int | None = Field(default=None, ge=0, le=65535)
    destination_port: int | None = Field(default=None, ge=0, le=65535)
