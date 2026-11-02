from fastapi import APIRouter

from app.schemas.behavior_analysis import BehaviorAnalyzeResponse, BehaviorEvent
from app.services.behavior_service import BehaviorAnalysisService
from app.services.incident_store import record_event

router = APIRouter(prefix="/analyze/behavior", tags=["Behavior Analysis"])
service = BehaviorAnalysisService()


@router.post("", response_model=BehaviorAnalyzeResponse)
def analyze_behavior(event: BehaviorEvent) -> dict:
    result = service.analyze(event.model_dump())

    record_event(
        {
            "request_id": result["request_id"],
            "threat_type": result["threat_type"],
            "risk_score": result["risk"]["risk_score"],
            "risk_level": result["risk"]["risk_level"],
            "confidence": result.get("confidence"),
            "explanation": result.get("explanation", ""),
            "indicators": result["risk"].get("indicators", []),
            "source": "behavior_model",
            "metadata": {
                "username": event.username,
                "source_ip": event.source_ip,
                "device_id": event.device_id,
                "event_type": event.event_type,
            },
        }
    )
    return result
