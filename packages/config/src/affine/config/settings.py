from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


ProviderName = Literal[
    "gemini", "anthropic", "copilot", "opencode-zen", "kilo-gateway", "voyage"
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    api_key: str | None = None
    google_api_key: str | None = None
    anthropic_api_key: str | None = None
    copilot_api_key: str | None = None
    opencode_api_key: str | None = None
    kilo_api_key: str | None = None
    voyage_api_key: str | None = None
    model_provider: ProviderName = "gemini"
    model_name: str | None = None
    copilot_base_url: str = "https://api.githubcopilot.com"
    opencode_base_url: str = "http://localhost:4096/zen/v1"
    kilo_base_url: str = "https://api.kilo.ai/api/gateway"
    host: str = "0.0.0.0"
    port: int = 9000
    cors_allow_origins: list[str] = []
    frontend_dist_dir: Path = Path("apps/web/dist")
    repo_index_enabled: bool = True
    repo_index_db_path: Path = Path(".cache/repo-index.db")
    repo_index_turso_sync_url: str | None = None
    repo_index_turso_auth_token: str | None = None
    repo_index_max_files: int = 1000
    repo_index_max_file_bytes: int = 262_144
    repo_index_bash_lsp_command: str = "bash-language-server"
    repo_index_python_lsp_command: str = "pylsp"
    repo_index_rust_lsp_command: str = "rust-analyzer"

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def parse_cors_allow_origins(cls, value: object) -> object:
        if isinstance(value, list):
            if not all(isinstance(origin, str) for origin in value):
                raise ValueError("CORS origins must be strings.")
            origins = [origin.strip() for origin in value if origin.strip()]
            return origins

        if not isinstance(value, str):
            return value

        origins = [origin.strip() for origin in value.split(",") if origin.strip()]
        return origins

    def provider_api_key(self) -> str | None:
        if self.model_provider == "anthropic":
            return self.anthropic_api_key
        if self.model_provider == "copilot":
            return self.copilot_api_key
        if self.model_provider == "opencode-zen":
            return self.opencode_api_key
        if self.model_provider == "kilo-gateway":
            return self.kilo_api_key
        if self.model_provider == "voyage":
            return self.voyage_api_key
        return self.google_api_key

    def provider_base_url(self) -> str | None:
        if self.model_provider == "opencode-zen":
            return self.opencode_base_url
        if self.model_provider == "copilot":
            return self.copilot_base_url
        if self.model_provider == "kilo-gateway":
            return self.kilo_base_url
        return None

    def provider_default_model(self) -> str:
        if self.model_provider == "anthropic":
            return "claude-sonnet-4-6"
        if self.model_provider == "copilot":
            return "claude-sonnet-4.6"
        if self.model_provider == "opencode-zen":
            return "opencode/glm-5.1"
        if self.model_provider == "kilo-gateway":
            return "kilo-auto/balanced"
        if self.model_provider == "voyage":
            return "voyage-code-3"
        return "gemini-3.1-pro-preview"


@lru_cache
def get_settings() -> Settings:
    return Settings()
