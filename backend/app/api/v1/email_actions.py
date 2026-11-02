from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.email_action_service import action_plan, execute_action, audit_events

router = APIRouter(tags=["email-response"])

class EmailActionRequest(BaseModel):
    request_id: str
    action_id: str
    analyst: str = "SOC Analyst"
    risk_level: str
    sender: str = ""
    urls: list[str] = []
    approved: bool = True

@router.get("/email-actions")
def get_email_actions(request_id: str, risk_level: str = "HIGH", sender: str = "", urls: str = ""):
    parsed_urls = [x for x in urls.split(",") if x]
    return {"request_id": request_id, "actions": action_plan(risk_level, sender, parsed_urls), "audit": audit_events(request_id)}

@router.post("/email-actions/execute")
def run_email_action(payload: EmailActionRequest):
    try:
        event = execute_action(
            request_id=payload.request_id, action_id=payload.action_id,
            analyst=payload.analyst, risk_level=payload.risk_level,
            sender=payload.sender, urls=payload.urls, approved=payload.approved,
        )
        return {"ok": True, "event": event, "audit": audit_events(payload.request_id)}
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
