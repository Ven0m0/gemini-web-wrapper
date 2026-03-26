"""Provider configuration and model aliases for the monorepo."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from affine.shared.schemas import ProviderType


class ModelAliases(BaseModel):
    """Model name aliases mapping OpenAI-compatible names to provider-specific models."""

    gpt_4o_mini: str = "gemini-2.5-flash"
    gpt_4o: str = "gemini-2.5-pro"
    gpt_4_1_mini: str = "gemini-3.0-pro"
    claude_3_5_sonnet: str = "claude-3-5-sonnet-20241022"


class GoogleProviderConfig(BaseModel):
    """Google Gemini provider configuration."""

    type: Literal["gemini"] = "gemini"
    api_key: str | None = None
    cookie_auth_profile: str | None = None


class AnthropicProviderConfig(BaseModel):
    """Anthropic Claude provider configuration."""

    type: Literal["anthropic"] = "anthropic"
    api_key: str


class CopilotProviderConfig(BaseModel):
    """GitHub Copilot provider configuration."""

    type: Literal["copilot"] = "copilot"
    github_token: str


class BifrostProviderConfig(BaseModel):
    """Bifrost AI gateway provider configuration."""

    type: Literal["bifrost"] = "bifrost"
    url: str = "http://localhost:8080/v1"
    api_key: str = "sk-bifrost-default"


ProviderConfig = Annotated[
    GoogleProviderConfig | AnthropicProviderConfig | CopilotProviderConfig | BifrostProviderConfig,
    Field(discriminant="type"),
]


__all__ = [
    "ProviderType",
    "ModelAliases",
    "GoogleProviderConfig",
    "AnthropicProviderConfig",
    "CopilotProviderConfig",
    "BifrostProviderConfig",
    "ProviderConfig",
]
