from typing import Literal

from llm_core.interfaces import LLMProvider
from llm_core.providers.anthropic import AnthropicProvider
from llm_core.providers.copilot import CopilotProvider
from llm_core.providers.gemini import GeminiProvider

ProviderType = Literal["gemini", "anthropic", "copilot"]

class ProviderFactory:
    """Factory for creating LLM providers."""

    @staticmethod
    def create(
        provider: ProviderType,
        api_key: str | None = None,
        model_name: str | None = None,
        **kwargs
    ) -> LLMProvider:
        if provider == "gemini":
            if not api_key:
                raise ValueError("API key required for Gemini provider")
            return GeminiProvider(api_key=api_key, model_name=model_name or "gemini-2.5-flash")

        elif provider == "anthropic":
            # API key can be None (loaded from env)
            return AnthropicProvider(api_key=api_key, model=model_name or "claude-3-5-sonnet-20241022")

        elif provider == "copilot":
            return CopilotProvider(**kwargs)

        else:
            raise ValueError(f"Unknown provider: {provider}")
