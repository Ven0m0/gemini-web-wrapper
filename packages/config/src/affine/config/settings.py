from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


ProviderName = Literal["gemini", "anthropic", "opencode-zen", "kilo-gateway"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    api_key: str | None = None
    google_api_key: str | None = None
    anthropic_api_key: str | None = None
    opencode_api_key: str | None = None
    kilo_api_key: str | None = None
    model_provider: ProviderName = "gemini"
    model_name: str | None = None
    opencode_base_url: str = "http://localhost:4096/zen/v1"
    kilo_base_url: str = "https://api.kilo.ai/api/gateway"
    host: str = "0.0.0.0"
    port: int = 9000
    cors_allow_origins: list[str] = ["*"]
    frontend_dist_dir: Path = Path("apps/web/dist")

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def parse_cors_allow_origins(cls, value: object) -> object:
        if isinstance(value, list):
            if not all(isinstance(origin, str) for origin in value):
                raise ValueError("CORS origins must be strings.")
            origins = [origin.strip() for origin in value if origin.strip()]
            return origins or ["*"]

        if not isinstance(value, str):
            return value

        origins = [origin.strip() for origin in value.split(",") if origin.strip()]
        return origins or ["*"]

    def provider_api_key(self) -> str | None:
        if self.model_provider == "anthropic":
            return self.anthropic_api_key
        if self.model_provider == "opencode-zen":
            return self.opencode_api_key
        if self.model_provider == "kilo-gateway":
            return self.kilo_api_key
        return self.google_api_key

    def provider_base_url(self) -> str | None:
        if self.model_provider == "opencode-zen":
            return self.opencode_base_url
        if self.model_provider == "kilo-gateway":
            return self.kilo_base_url
        return None

    def provider_default_model(self) -> str:
        if self.model_provider == "anthropic":
            return "claude-sonnet-4-6"
        if self.model_provider == "opencode-zen":
            return "opencode/gpt-5.4"
        if self.model_provider == "kilo-gateway":
            return "kilo-auto/balanced"
        return "gemini-2.5-flash"


@lru_cache
def get_settings() -> Settings:
    return Settings()
