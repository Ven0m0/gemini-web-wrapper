from __future__ import annotations

from typing import Any, Literal

from llm_core.interfaces import LLMProvider
from llm_core.providers.anthropic import AnthropicProvider
from llm_core.providers.bifrost import BifrostProvider
from llm_core.providers.copilot import CopilotProvider
from llm_core.providers.gemini import GeminiProvider

ProviderType = Literal["gemini", "anthropic", "copilot", "bifrost"]


class ProviderFactory:
    """Factory for creating LLM provider implementations."""

    @staticmethod
    def create(
        provider: ProviderType,
        api_key: str | None = None,
        model_name: str | None = None,
        **kwargs: Any,
    ) -> LLMProvider:
        """Create an LLM provider.

        Args:
            provider: Provider identifier.
            api_key: Optional API key for the provider.
            model_name: Optional model override.
            **kwargs: Provider-specific parameters.

        Returns:
            An initialized provider instance.

        Raises:
            ValueError: If provider is unknown or required configuration is missing.
        """
        match provider:
            case "gemini":
                if not api_key:
                    raise ValueError("API key required for Gemini provider")
                return GeminiProvider(
                    api_key=api_key,
                    model_name=model_name or "gemini-2.5-flash",
                )
            case "anthropic":
                return AnthropicProvider(
                    api_key=api_key,
                    model=model_name or "claude-3-5-sonnet-20241022",
                )
            case "copilot":
                return CopilotProvider(**kwargs)
            case "bifrost":
                return BifrostProvider(
                    api_key=api_key,
                    model=model_name or "gpt-4o-mini",
                    **kwargs,
                )
            case _:
                raise ValueError(f"Unknown provider: {provider}")
