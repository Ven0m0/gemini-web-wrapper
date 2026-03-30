import pytest
from affine.llm_core.factory import ProviderFactory
from affine.llm_core.providers.gemini import GeminiProvider
from affine.llm_core.providers.anthropic import AnthropicProvider


def test_provider_factory():
    gemini = ProviderFactory.create("gemini", api_key="test")
    assert isinstance(gemini, GeminiProvider)
    assert gemini.name == "gemini"

    anthropic = ProviderFactory.create("anthropic", api_key="test")
    assert isinstance(anthropic, AnthropicProvider)
    assert anthropic.name == "anthropic"

    with pytest.raises(ValueError):
        ProviderFactory.create("unknown")
