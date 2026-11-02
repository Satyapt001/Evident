"""Application configuration for EVIDENT backend."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EVIDENT CyberGuard API"
    app_version: str = "0.1.0"
    environment: str = "development"
    api_prefix: str = "/api/v1"

    # URL-analysis controls
    default_fetch_timeout: int = Field(default=8, ge=1, le=30)
    max_fetch_timeout: int = Field(default=15, ge=1, le=30)

    # Browser/API clients
    cors_origins: str = "*"

    model_path: str = "models/phishing/phishing_model.pkl"
    metadata_path: str = "models/phishing/model_metadata.json"

    # Deepfake model
    # The large DF40 checkpoint may be stored outside the source ZIP. The
    # service resolves this value against the project root and also supports
    # the compact root-level `df40_weights/train_on_fs/clip.pth` layout.
    deepfake_model_path: str = ""

    # Authentication (security-team admin sign-in)
    # AUTH_REQUIRED=true makes every analysis/operations endpoint demand a valid
    # bearer token. /health and /auth/* stay public so the console can sign in.
    auth_required: bool = False
    auth_secret_key: str = ""  # blank -> a random key is generated once and stored with the user store
    auth_token_ttl_minutes: int = Field(default=480, ge=5, le=60 * 24 * 14)
    auth_store_path: str = "data/auth_store.json"
    auth_max_failed_attempts: int = Field(default=5, ge=3, le=20)
    auth_lockout_minutes: int = Field(default=15, ge=1, le=240)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def resolved_deepfake_model_path(self) -> str:
        from pathlib import Path
        root = Path(__file__).resolve().parents[3]
        configured = Path(self.deepfake_model_path) if self.deepfake_model_path else None
        candidates = []
        if configured:
            candidates.append(configured if configured.is_absolute() else root / configured)
        candidates.extend([
            root / "df40_weights" / "train_on_fs" / "clip.pth",
            root / "external" / "DeepfakeBench_DF40" / "DF40" / "DeepfakeBench_DF40" / "training" / "df40_weights" / "train_on_fs" / "clip.pth",
        ])
        for candidate in candidates:
            if candidate.is_file():
                return str(candidate)
        # Return the primary expected location for a useful error message.
        return str(candidates[0] if candidates else root / "df40_weights" / "train_on_fs" / "clip.pth")

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
