from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.schemas.behavior_model3 import NetworkFlowAnalysisRequest
from app.services.behavior_model3 import analyze_network_flow
from app.services.incident_store import record_event

router = APIRouter(prefix="/analyze/network", tags=["Model 3 - Network Threat"])


@router.get("/health")
def health():
    try:
        from src.behavior.inference import load_model

        artifact = load_model()
        return {
            "status": "ready",
            "model": "EVIDENT Network Threat Detector",
            "features": len(artifact["feature_columns"]),
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("")
def analyze(request: NetworkFlowAnalysisRequest):
    try:
        request_id = str(uuid4())
        result = analyze_network_flow(
            request.flow,
            request_id=request_id,
            source_ip=request.source_ip,
            destination_ip=request.destination_ip,
            source_port=request.source_port,
            destination_port=request.destination_port,
        )

        model = result["model"]
        risk = result["risk"]

        # The exact request_id returned to the analyst is also the request_id
        # stored in the incident ledger. This makes response controls operate
        # on the prediction the analyst is actually viewing.
        record_event(
            {
                "request_id": request_id,
                "prediction": model.get("prediction"),
                "threat_type": model.get("attack_family", "NETWORK_ATTACK"),
                "risk_score": risk["risk_score"],
                "risk_level": risk["risk_level"],
                "confidence": model.get("attack_probability"),
                "explanation": result.get("explanation", ""),
                "indicators": risk.get("indicators", []),
                "source": "network_model3",
                "metadata": {
                    "model": model.get("model"),
                    "prediction": model.get("prediction"),
                    "attack_probability": model.get("attack_probability"),
                    "attack_family": model.get("attack_family"),
                    "response": result.get("response", {}),
                    "recommendations": result.get("response", {}).get("recommendations", []),
                    "source_ip": request.source_ip,
                    "destination_ip": request.destination_ip,
                    "source_port": request.source_port,
                    "destination_port": request.destination_port,
                    "flow_features": request.flow,
                },
            }
        )
        return result
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Network threat analysis failed.") from exc
