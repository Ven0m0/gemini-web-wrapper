from typing import Any

from affine.config import ProviderName
from affine.llm_core.providers.copilot import CopilotProvider
from affine.llm_core.interfaces import LLMProvider
from affine.llm_core.providers.anthropic import AnthropicProvider
from affine.llm_core.providers.gemini import GeminiProvider
from affine.llm_core.providers.openai_compatible import OpenAICompatibleProvider

PROVIDER_REGISTRY: dict[ProviderName, type[LLMProvider]] = {
    "gemini": GeminiProvider,
    "anthropic": AnthropicProvider,
    "copilot": CopilotProvider,
}


class ProviderFactory:
    @staticmethod
    def is_registered(provider_type: str) -> bool:
        return provider_type in PROVIDER_REGISTRY

    @staticmethod
    def create(provider_type: ProviderName | str, **kwargs: Any) -> LLMProvider:
        provider_class = PROVIDER_REGISTRY.get(provider_type)
        if provider_class is not None:
            return provider_class(**kwargs)
        if not kwargs.get("base_url"):
            raise ValueError(f"Unknown provider: {provider_type}")
        return OpenAICompatibleProvider(provider_name=str(provider_type), **kwargs)
