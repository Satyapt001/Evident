from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class AdminAction(BaseModel):
    action_id: str
    name: str
    description: str
    category: str
    priority: str
    requires_approval: bool
    available: bool = True
    recommended: bool = False
    reason: str = ""
    status: str = "PROPOSED"


class ActionExecuteRequest(BaseModel):
    request_id: str = Field(min_length=1)
    action_id: str = Field(min_length=1)
    approved: bool = False
    note: str = ""
    actor: str = "SOC Analyst"


class ActionExecution(BaseModel):
    action_id: str
    name: str
    status: str
    message: str
    actor: str
    timestamp: str
    request_id: str
    incident_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ActionListResponse(BaseModel):
    request_id: str
    incident_id: str | None = None
    actions: list[AdminAction]
    executions: list[ActionExecution] = Field(default_factory=list)
    case: dict[str, Any] | None = None
