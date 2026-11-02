from fastapi import APIRouter, Query
from app.schemas.incident import DashboardResponse, IncidentEvent, IncidentResponse
from app.services.incident_store import dashboard_summary, list_events, record_event

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.post("", response_model=IncidentResponse)
def create_incident(event: IncidentEvent):
    stored = record_event(event.model_dump())
    return {"stored": True, "incident": stored}

@router.get("", response_model=list[IncidentEvent])
def get_incidents(limit: int = Query(50, ge=1, le=1000)):
    return list_events(limit)

@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard():
    return dashboard_summary()
