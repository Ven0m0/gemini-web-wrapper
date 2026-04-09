import pytest

from affine.llm_core.factory import ProviderFactory
from affine.llm_core.providers.anthropic import AnthropicProvider
from affine.llm_core.providers.copilot import CopilotProvider
from affine.llm_core.providers.gemini import GeminiProvider
from affine.llm_core.providers.openai_compatible import OpenAICompatibleProvider


def test_provider_factory() -> None:
    gemini = ProviderFactory.create("gemini", api_key="test")
    assert isinstance(gemini, GeminiProvider)
    assert gemini.name == "gemini"

    anthropic = ProviderFactory.create("anthropic", api_key="test")
    assert isinstance(anthropic, AnthropicProvider)
    assert anthropic.name == "anthropic"

    copilot = ProviderFactory.create("copilot", api_key="test")
    assert isinstance(copilot, CopilotProvider)
    assert copilot.name == "copilot"

    custom = ProviderFactory.create(
        "myprovider", model="gpt-4o-mini", base_url="https://api.example.com/v1"
    )
    assert isinstance(custom, OpenAICompatibleProvider)
    assert custom.name == "myprovider"

    with pytest.raises(ValueError):
        ProviderFactory.create("unknown")


def test_provider_factory_requires_explicit_api_key() -> None:
    with pytest.raises(ValueError, match="Gemini API key"):
        ProviderFactory.create("gemini")

    with pytest.raises(ValueError, match="Anthropic API key"):
        ProviderFactory.create("anthropic")

    with pytest.raises(ValueError, match="GitHub Copilot API key"):
        ProviderFactory.create("copilot")


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


def test_openai_compatible_provider_builds_request_body() -> None:
    provider = OpenAICompatibleProvider(
        provider_name="myprovider",
        model="gpt-4o-mini",
        base_url="https://api.example.com/v1",
    )

    body = provider._build_request_body(
        "hello",
        system="system prompt",
        history=[{"role": "assistant", "content": "prior"}],
        stream=False,
    )

    assert body == {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "system prompt"},
            {"role": "assistant", "content": "prior"},
            {"role": "user", "content": "hello"},
        ],
        "stream": False,
        "max_tokens": 4096,
        "temperature": 0.7,
    }
