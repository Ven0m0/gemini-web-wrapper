from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


ProviderName = Literal["gemini", "anthropic"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    api_key: str | None = None
    google_api_key: str | None = None
    anthropic_api_key: str | None = None
    model_provider: ProviderName = "gemini"
    model_name: str | None = None
    host: str = "0.0.0.0"
    port: int = 9000
    cors_allow_origins: list[str] = ["*"]
    frontend_dist_dir: Path = Path("apps/web/dist")

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def parse_cors_allow_origins(cls, value: object) -> object:
        if not isinstance(value, str):
            return value

        origins = [origin.strip() for origin in value.split(",") if origin.strip()]
        return origins or ["*"]

    def provider_api_key(self) -> str | None:
        if self.model_provider == "anthropic":
            return self.anthropic_api_key
        return self.google_api_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
