from fastapi import APIRouter, HTTPException, Query

from app.schemas.actions import ActionExecuteRequest, ActionExecution, ActionListResponse
from app.services.action_service import build_action_context, execute_action
from app.services.incident_store import list_actions

router = APIRouter(prefix="/actions", tags=["Admin Actions"])


@router.get("", response_model=ActionListResponse)
def get_available_actions(request_id: str = Query(..., min_length=1)):
    try:
        event, actions = build_action_context(request_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "request_id": request_id,
        "incident_id": event.get("event_id"),
        "actions": actions,
        "executions": list_actions(event["event_id"]),
    }


@router.post("/execute", response_model=ActionExecution)
def run_action(payload: ActionExecuteRequest):
    try:
        return execute_action(
            request_id=payload.request_id,
            action_id=payload.action_id,
            approved=payload.approved,
            note=payload.note,
            actor=payload.actor,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
