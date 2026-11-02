"""Health and service status schemas."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
