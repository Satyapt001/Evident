from typing import Any
from pydantic import BaseModel, Field

class BlockIPRequest(BaseModel):
    ip_address: str
    severity: str = "HIGH"
    reason: str = "Manual administrator security block"
    source: str = "ADMINISTRATOR"

class LockdownRequest(BaseModel):
    enabled: bool = True
    reason: str = "Universal enterprise lockdown"

class NetworkPresetResponse(BaseModel):
    id: str
    label: str
    description: str
    flow: dict[str, Any] = Field(default_factory=dict)
