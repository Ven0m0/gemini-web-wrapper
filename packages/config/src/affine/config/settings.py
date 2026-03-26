"""Typed settings for Affine AI Coding Workstation.

Environment variables are validated using Pydantic Settings.
All settings are typed and have sensible defaults.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    All settings can be overridden via environment variables or .env files.
    Sensitive values should be set via environment variables in production.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # === Application Mode ===
    app_mode: Literal["server-managed", "browser-only", "local-workspace-enabled"] = (
        "server-managed"
    )

    # === Trust & Feature Flags ===
    trust_level: Literal["safe", "trusted-local", "trusted-remote", "experimental"] = (
        "safe"
    )

    # Feature flags
    feature_local_workspace: bool = False
    feature_browser_only_providers: bool = False
    feature_vision: bool = True
    feature_shell_exec: bool = False
    feature_remote_plugins: bool = False
    feature_experimental_mcp: bool = False

    # === Provider Configuration ===
    model_provider: Literal["gemini", "anthropic", "copilot", "bifrost"] = "gemini"
    model_name: str = ""

    # === API Keys ===
    google_api_key: str = ""
    anthropic_api_key: str = ""
    github_token: str = ""
    bifrost_url: str = "http://localhost:8080/v1"
    bifrost_api_key: str = "sk-bifrost-default"
    composio_api_key: str = ""

    # === Server Configuration ===
    cors_allow_origins: str = "*"
    cors_allow_credentials: bool = True
    cors_allow_methods: str = "*"
    cors_allow_headers: str = "*"

    port: int = 9000
    host: str = "0.0.0.0"
    frontend_dist_dir: str = "apps/web/dist"
    debug: bool = False
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # === Database ===
    database_url: str = ""

    # === Execution Mode ===
    execution_mode: Literal["server", "browser", "local"] = "server"

    # === Model Aliases ===
    # Maps OpenAI model names to provider-specific models
    model_aliases: dict[str, str] = Field(
        default_factory=lambda: {
            "gpt-4o-mini": "gemini-2.5-flash",
            "gpt-4o": "gemini-2.5-pro",
            "gpt-4.1-mini": "gemini-3.0-pro",
            "gemini-flash": "gemini-2.5-flash",
            "gemini-pro": "gemini-2.5-pro",
            "gemini-3-pro": "gemini-3.0-pro",
            "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
        }
    )


    def resolve_model(self, requested: str | None) -> str:
        """Resolve an OpenAI-style model alias to a provider model name."""

        if not requested:
            return self.model_name or "gemini-2.5-flash"
        return self.model_aliases.get(requested, requested)


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance.

    Settings are loaded once and cached for the lifetime of the process.
    Use this function instead of creating Settings instances directly.
    """
    return Settings()
