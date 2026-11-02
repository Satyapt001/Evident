"""URL analysis API endpoint."""
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from app.core.config import get_settings
from app.schemas.url_analysis import URLAnalyzeRequest, URLAnalyzeResponse
from app.services.incident_store import record_event
from app.services.phishing_service import PhishingAnalysisService

router = APIRouter(prefix="/analyze", tags=["threat-analysis"])


@router.post("/url", response_model=URLAnalyzeResponse)
def analyze_url(
    payload: URLAnalyzeRequest,
    request: Request,
) -> URLAnalyzeResponse:
    settings = get_settings()
    timeout = min(payload.timeout, settings.max_fetch_timeout)
    request_id = getattr(request.state, "request_id", str(uuid4()))

    try:
        service = PhishingAnalysisService(
            model_path=settings.model_path,
            metadata_path=settings.metadata_path,
        )
        result = service.analyze(
            url=str(payload.url),
            fetch_page=payload.fetch_page,
            timeout=timeout,
        )

        risk = result["risk"]
        stored = record_event(
            {
                "request_id": request_id,
                "threat_type": "PHISHING",
                "risk_score": risk["risk_score"],
                "risk_level": risk["risk_level"],
                "confidence": risk.get("phishing_probability"),
                "prediction": result["model"].get("prediction", ""),
                "explanation": risk.get("severity_description", ""),
                "indicators": risk.get("indicators", []),
                "source": "phishing_model",
                "metadata": {
                    "url": str(payload.url),
                    "model": result["model"]["name"],
                    "prediction": result["model"].get("prediction", ""),
                    "phishing_probability": result["model"].get("phishing_probability"),
                    "response": result.get("response", {}),
                    "recommendations": result.get("response", {}).get("recommendations", []),
                    "threat_intelligence": result.get("threat_intelligence", {}),
                },
            }
        )
        result["response"]["incident_id"] = stored.get("event_id")

        return URLAnalyzeResponse(
            request_id=request_id,
            url=str(payload.url),
            **result,
        )

    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=f"Model configuration error: {exc}") from exc
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="URL analysis failed.") from exc
