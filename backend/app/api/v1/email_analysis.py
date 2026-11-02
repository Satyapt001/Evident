from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from app.schemas.email_analysis import EmailAnalyzeRequest, EmailAnalysisResponse
from app.services.social_engineering_service import analyze_email

router = APIRouter(tags=["social-engineering"])


@router.post("/analyze/email", response_model=EmailAnalysisResponse)
def analyze_email_endpoint(payload: EmailAnalyzeRequest, request: Request):
    if not payload.subject.strip() and not payload.body.strip():
        raise HTTPException(status_code=422, detail="Email subject or body is required.")

    request_id = getattr(request.state, "request_id", str(uuid4()))

    try:
        return analyze_email(
            sender=payload.sender.strip(),
            subject=payload.subject.strip(),
            body=payload.body,
            request_id=request_id,
            analyze_urls=payload.analyze_urls,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Email analysis failed: {exc}") from exc
