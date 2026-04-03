from typing import Any

from affine.config import ProviderName
from affine.llm_core.interfaces import LLMProvider
from affine.llm_core.providers.anthropic import AnthropicProvider
from affine.llm_core.providers.gemini import GeminiProvider

PROVIDER_REGISTRY: dict[str, type[LLMProvider]] = {
    "gemini": GeminiProvider,
    "anthropic": AnthropicProvider,
}


class ProviderFactory:
    @staticmethod
    def create(provider_type: ProviderName | str, **kwargs: Any) -> LLMProvider:
        provider_class = PROVIDER_REGISTRY.get(provider_type)
        if provider_class is None:
            raise ValueError(f"Unknown provider: {provider_type}")
        return provider_class(**kwargs)
