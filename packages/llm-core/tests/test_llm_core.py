import asyncio

import httpx
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


def _mock_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_gemini_list_models_filters_chat_models() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "models": [
                    {
                        "name": "models/gemini-pro",
                        "displayName": "Gemini Pro",
                        "supportedGenerationMethods": ["generateContent"],
                    },
                    {
                        "name": "models/text-embedding",
                        "displayName": "Embedding",
                        "supportedGenerationMethods": ["embedContent"],
                    },
                ]
            },
        )

    provider = GeminiProvider(api_key="test")
    provider._client = _mock_client(handler)

    models = asyncio.run(provider.list_models())

    assert models == [{"id": "gemini-pro", "name": "Gemini Pro"}]
    assert seen[0].url.path.endswith("/models")
    assert seen[0].url.params["key"] == "test"
    assert seen[0].url.params["pageSize"] == "1000"


def test_anthropic_list_models_uses_display_name() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={"data": [{"id": "claude-x", "display_name": "Claude X"}]},
        )

    provider = AnthropicProvider(api_key="test")
    provider._client = _mock_client(handler)

    models = asyncio.run(provider.list_models())

    assert models == [{"id": "claude-x", "name": "Claude X"}]
    assert seen[0].headers["x-api-key"] == "test"
    assert seen[0].url.params["limit"] == "1000"


def test_openai_compatible_list_models_falls_back_to_id() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://api.example.com/v1/models"
        assert request.headers["authorization"] == "Bearer secret"
        return httpx.Response(
            200,
            json={"data": [{"id": "gpt-a", "name": "GPT A"}, {"id": "gpt-b"}]},
        )

    provider = OpenAICompatibleProvider(
        provider_name="myprovider",
        model="placeholder",
        base_url="https://api.example.com/v1/",
        api_key="secret",
    )
    provider._client = _mock_client(handler)

    models = asyncio.run(provider.list_models())

    assert models == [
        {"id": "gpt-a", "name": "GPT A"},
        {"id": "gpt-b", "name": "gpt-b"},
    ]


def test_openai_compatible_list_models_skips_non_chat_models() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": [
                    {"id": "gpt-a"},
                    {"id": "text-embedding-3-small"},
                    {"id": "whisper-1"},
                    {"id": "tts-1"},
                    {"id": "dall-e-3"},
                    {"id": "omni-moderation-latest"},
                    {"id": "copilot-chat", "capabilities": {"type": "chat"}},
                    {"id": "copilot-embed", "capabilities": {"type": "embeddings"}},
                ]
            },
        )

    provider = CopilotProvider(api_key="test")
    provider._client = _mock_client(handler)

    models = asyncio.run(provider.list_models())

    assert [m["id"] for m in models] == ["gpt-a", "copilot-chat"]


def test_list_models_raises_on_error_status() -> None:
    provider = CopilotProvider(api_key="test")
    provider._client = _mock_client(lambda request: httpx.Response(401))

    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(provider.list_models())
