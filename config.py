"""Application configuration and settings.

This module provides Settings class loaded from environment or .env file,
model alias resolution, and other configuration-related functionality.
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment or .env file."""

    model_config = SettingsConfigDict(env_file=".env")

    google_api_key: str
    model_provider: str = "gemini"
    model_name: str | None = None
    anthropic_api_key: str | None = None

    # Model aliases for OpenAI compatibility
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
        """Return a Gemini model name for a requested OpenAI-style name."""
        if not requested:
            return self.model_name or "gemini-2.5-flash"
        if requested in self.model_aliases:
            return self.model_aliases[requested]
        return requested
