"""EVIDENT CyberGuard FastAPI application."""
# Initialize PyTorch before other application modules load native libraries.
import torch

print(f"[Startup] PyTorch initialized: {torch.__version__}")
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware

configure_logging()
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "CYBERGUARD API for AI-assisted cyber threat analysis. "
        "Current implementation exposes phishing URL analysis through Model 1."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False if settings.cors_origin_list == ["*"] else True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(router, prefix=settings.api_prefix)


@app.get("/", tags=["system"])
def root():
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "api": settings.api_prefix,
        "docs": "/docs",
    }
