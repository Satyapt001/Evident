"""Versioned API router for EVIDENT/CyberGuard."""
from fastapi import APIRouter, Depends

from app.api.v1.actions import router as actions_router
from app.api.v1.admin import router as admin_router
from app.api.v1.auth import require_user, router as auth_router
from app.api.v1.behavior_analysis import router as behavior_analysis_router
from app.api.v1.behavior_model3 import router as behavior_model3_router
from app.api.v1.deepfake_analysis import router as deepfake_analysis_router
from app.api.v1.email_analysis import router as email_analysis_router
from app.api.v1.health import router as health_router
from app.api.v1.incidents import router as incidents_router
from app.api.v1.malware_triage import router as malware_triage_router
from app.api.v1.network_operations import router as network_operations_router
from app.api.v1.telemetry import router as telemetry_router
from app.api.v1.url_analysis import router as url_analysis_router

router = APIRouter()

# Public: liveness probe and the sign-in endpoints.
router.include_router(health_router)
router.include_router(auth_router)

# Protected: every other module. require_user is a no-op unless AUTH_REQUIRED=true.
_protected = [Depends(require_user)]
for _router in (
    actions_router,
    admin_router,
    url_analysis_router,
    deepfake_analysis_router,
    behavior_analysis_router,
    behavior_model3_router,
    incidents_router,
    email_analysis_router,
    network_operations_router,
    telemetry_router,
    malware_triage_router,
):
    router.include_router(_router, dependencies=_protected)
