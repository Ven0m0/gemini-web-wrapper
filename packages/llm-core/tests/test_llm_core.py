import pytest

from affine.llm_core.factory import ProviderFactory
from affine.llm_core.providers.anthropic import AnthropicProvider
from affine.llm_core.providers.gemini import GeminiProvider


def test_provider_factory() -> None:
    gemini = ProviderFactory.create("gemini", api_key="test")
    assert isinstance(gemini, GeminiProvider)
    assert gemini.name == "gemini"

    anthropic = ProviderFactory.create("anthropic", api_key="test")
    assert isinstance(anthropic, AnthropicProvider)
    assert anthropic.name == "anthropic"

    with pytest.raises(ValueError):
        ProviderFactory.create("unknown")


def test_provider_factory_requires_explicit_api_key() -> None:
    with pytest.raises(ValueError, match="Gemini API key"):
        ProviderFactory.create("gemini")

    with pytest.raises(ValueError, match="Anthropic API key"):
        ProviderFactory.create("anthropic")


def test_gemini_provider_builds_request_body() -> None:
    provider = GeminiProvider(api_key="test", model="gemini-test")

    body = provider._build_request_body(
        "hello",
        system="system prompt",
        history=[{"role": "assistant", "content": "prior"}],
        max_tokens=123,
        temperature=0.2,
    )

    assert body == {
        "contents": [
            {"role": "model", "parts": [{"text": "prior"}]},
            {"role": "user", "parts": [{"text": "hello"}]},
        ],
        "generationConfig": {"maxOutputTokens": 123, "temperature": 0.2},
        "systemInstruction": {"parts": [{"text": "system prompt"}]},
    }


def test_anthropic_provider_builds_request_body() -> None:
    provider = AnthropicProvider(api_key="test", model="claude-test")

    body = provider._build_request_body(
        "hello",
        system="system prompt",
        history=[{"role": "assistant", "content": "prior"}],
        stream=True,
        max_tokens=321,
    )

    assert body == {
        "model": "claude-test",
        "max_tokens": 321,
        "messages": [
            {"role": "assistant", "content": "prior"},
            {"role": "user", "content": "hello"},
        ],
        "stream": True,
        "system": "system prompt",
    }
