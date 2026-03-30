from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    model_provider: str = "gemini"
    model_name: Optional[str] = None
    host: str = "0.0.0.0"
    port: int = 9000
    cors_allow_origins: str = "*"
    frontend_dist_dir: str = "apps/web/dist"


def get_settings() -> Settings:
    return Settings()
