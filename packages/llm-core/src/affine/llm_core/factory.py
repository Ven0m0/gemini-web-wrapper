from affine.llm_core.interfaces import LLMProvider
from affine.llm_core.providers.gemini import GeminiProvider
from affine.llm_core.providers.anthropic import AnthropicProvider


class ProviderFactory:
    @staticmethod
    def create(provider_type: str, **kwargs) -> LLMProvider:
        if provider_type == "gemini":
            return GeminiProvider(**kwargs)
        elif provider_type == "anthropic":
            return AnthropicProvider(**kwargs)
        else:
            raise ValueError(f"Unknown provider: {provider_type}")
