"""Deepfake image analysis API endpoint."""
from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import get_settings
from app.schemas.deepfake_analysis import DeepfakeAnalyzeResponse
from app.services.deepfake_service import DeepfakeAnalysisService
from app.services.incident_store import record_event

router = APIRouter(prefix="/analyze", tags=["threat-analysis"])
_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


@router.post("/image", response_model=DeepfakeAnalyzeResponse)
def analyze_image(file: UploadFile = File(...)) -> DeepfakeAnalyzeResponse:
    settings = get_settings()
    filename = file.filename or "uploaded_image"
    extension = Path(filename).suffix.lower()

    if extension not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported image format. Allowed formats: {sorted(_ALLOWED_EXTENSIONS)}",
        )

    temp_path = None
    try:
        with NamedTemporaryFile(suffix=extension, delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            while chunk := file.file.read(1024 * 1024):
                temp_file.write(chunk)

        service = DeepfakeAnalysisService(model_path=settings.resolved_deepfake_model_path)
        result = service.analyze(temp_path)

        request_id = str(uuid4())
        risk = result["risk"]
        record_event(
            {
                "request_id": request_id,
                "threat_type": "DEEPFAKE",
                "risk_score": risk["risk_score"],
                "risk_level": risk["risk_level"],
                "confidence": result["model"].get("class_1_probability"),
                "explanation": risk.get("severity_description", ""),
                "indicators": risk.get("indicators", []),
                "source": "deepfake_model",
                "metadata": {
                    "filename": filename,
                    "model": result["model"]["name"],
                    "predicted_class": result["model"]["predicted_class"],
                },
            }
        )

        return DeepfakeAnalyzeResponse(
            request_id=request_id,
            filename=filename,
            **result,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=f"Deepfake model unavailable: {exc}") from exc
    except RuntimeError as exc:
        # 503 means the API is healthy but the inference engine cannot serve
        # this request (for example, a missing/incompatible native runtime).
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Deepfake inference failed: {exc}") from exc
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
