"""Tests for the chat completions endpoint.

Covers:
- Health check
- Auth enforcement when a server API key is configured
- Open/public mode when no server API key is configured
- Request-level provider override (x_provider + x_provider_api_key)
- Custom OpenAI-compatible provider override (x_provider + x_provider_base_url)
- Server-configured fallback when no request-level keys are supplied
- Rejection of custom x_provider values without a base URL
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from affine.config.settings import Settings, get_settings
from fastapi.testclient import TestClient

from affine.api.server import app

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_MESSAGES = [{"role": "user", "content": "hello"}]


def make_settings(**kwargs: Any) -> Settings:
    defaults: dict[str, Any] = {
        "api_key": "server-gate-key",
        "google_api_key": "server-google-key",
        "anthropic_api_key": "server-anthropic-key",
        "copilot_api_key": "server-copilot-key",
        "model_provider": "gemini",
        "model_name": None,
    }
    defaults.update(kwargs)
    return Settings(**defaults)


def _mock_provider(return_text: str = "ok") -> MagicMock:
    provider = MagicMock()
    provider.generate = AsyncMock(return_value=return_text)
    provider.stream = MagicMock()
    provider.aclose = AsyncMock()
    return provider


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def client_with_key():
    """TestClient where the server has a gateway API key configured."""
    app.dependency_overrides[get_settings] = lambda: make_settings()
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def client_open():
    """TestClient in open/public mode (no server gateway key)."""
    app.dependency_overrides[get_settings] = lambda: make_settings(api_key=None)
    yield TestClient(app)
    app.dependency_overrides.clear()


AUTH = {"Authorization": "Bearer server-gate-key"}

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


def test_health(client_with_key: TestClient) -> None:
    resp = client_with_key.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Auth enforcement
# ---------------------------------------------------------------------------


def test_chat_completions_requires_auth_when_key_configured(
    client_with_key: TestClient,
) -> None:
    resp = client_with_key.post(
        "/v1/chat/completions",
        json={"model": "gemini-3.1-pro-preview", "messages": VALID_MESSAGES},
    )
    assert resp.status_code == 401


def test_chat_completions_fails_closed_when_unconfigured(
    client_open: TestClient,
) -> None:
    resp = client_open.post(
        "/v1/chat/completions",
        json={
            "model": "gemini-3.1-pro-preview",
            "messages": VALID_MESSAGES,
            "x_provider": "gemini",
            "x_provider_api_key": "user-gemini-key",
        },
    )
    assert resp.status_code == 500
    assert resp.json()["detail"].startswith("Server API key is not configured")


# ---------------------------------------------------------------------------
# Server-configured provider fallback
# ---------------------------------------------------------------------------


def test_chat_completions_uses_server_provider_when_no_request_keys(
    client_with_key: TestClient,
) -> None:
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _mock_provider("server response")

        resp = client_with_key.post(
            "/v1/chat/completions",
            headers=AUTH,
            json={"model": "gemini-3.1-pro-preview", "messages": VALID_MESSAGES},
        )

    assert resp.status_code == 200
    mock_create.assert_called_once()
    call_args = mock_create.call_args
    # First positional arg is provider type; keyword arg is api_key
    assert call_args[0][0] == "gemini"
    assert call_args[1].get("api_key") == "server-google-key"


# ---------------------------------------------------------------------------
# Request-level provider override
# ---------------------------------------------------------------------------


def test_chat_completions_uses_request_provider_when_supplied(
    client_with_key: TestClient,
) -> None:
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _mock_provider("user provider response")

        resp = client_with_key.post(
            "/v1/chat/completions",
            headers=AUTH,
            json={
                "model": "claude-sonnet-4-6",
                "messages": VALID_MESSAGES,
                "x_provider": "anthropic",
                "x_provider_api_key": "user-anthropic-key",
            },
        )

    assert resp.status_code == 200
    mock_create.assert_called_once()
    call_args = mock_create.call_args
    assert call_args[0][0] == "anthropic"
    assert call_args[1].get("api_key") == "user-anthropic-key"
    # model from request should be forwarded to the provider
    assert call_args[1].get("model") == "claude-sonnet-4-6"


def test_chat_completions_request_gemini_key_overrides_server(
    client_with_key: TestClient,
) -> None:
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _mock_provider("gemini user key response")

        resp = client_with_key.post(
            "/v1/chat/completions",
            headers=AUTH,
            json={
                "model": "gemini-3.1-pro-preview",
                "messages": VALID_MESSAGES,
                "x_provider": "gemini",
                "x_provider_api_key": "AIza-user-gemini-key",
            },
        )

    assert resp.status_code == 200
    call_args = mock_create.call_args
    assert call_args[0][0] == "gemini"
    assert call_args[1].get("api_key") == "AIza-user-gemini-key"


def test_chat_completions_missing_api_key_falls_back_to_server(
    client_with_key: TestClient,
) -> None:
    """x_provider without x_provider_api_key silently falls back to server."""
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _mock_provider("server fallback")

        resp = client_with_key.post(
            "/v1/chat/completions",
            headers=AUTH,
            json={
                "model": "gemini-3.1-pro-preview",
                "messages": VALID_MESSAGES,
                "x_provider": "gemini",
                # no x_provider_api_key → falls back to server config
            },
        )

    assert resp.status_code == 200
    call_args = mock_create.call_args
    # Should have used the server google key, not a user key
    assert call_args[1].get("api_key") == "server-google-key"


def test_chat_completions_no_provider_key_returns_400() -> None:
    """No request key and no server provider key is a clear 400, not a bare 500."""
    app.dependency_overrides[get_settings] = lambda: make_settings(google_api_key=None)
    try:
        resp = TestClient(app).post(
            "/v1/chat/completions",
            headers=AUTH,
            json={"model": "gemini-3.1-pro-preview", "messages": VALID_MESSAGES},
        )
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 400
    assert "No API key" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Custom provider validation
# ---------------------------------------------------------------------------


def test_chat_completions_custom_provider_with_base_url(
    client_with_key: TestClient,
) -> None:
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _mock_provider("custom provider response")

        resp = client_with_key.post(
            "/v1/chat/completions",
            headers=AUTH,
            json={
                "model": "gpt-4o-mini",
                "messages": VALID_MESSAGES,
                "x_provider": "myprovider",
                "x_provider_base_url": "https://api.example.com/v1",
            },
        )

    assert resp.status_code == 200
    call_args = mock_create.call_args
    assert call_args[0][0] == "myprovider"
    assert call_args[1].get("base_url") == "https://api.example.com/v1"
    assert call_args[1].get("model") == "gpt-4o-mini"
    assert "api_key" not in call_args[1]


def test_chat_completions_custom_provider_requires_base_url(
    client_with_key: TestClient,
) -> None:
    resp = client_with_key.post(
        "/v1/chat/completions",
        headers=AUTH,
        json={
            "model": "gpt-4o",
            "messages": VALID_MESSAGES,
            "x_provider": "openai",
            "x_provider_api_key": "sk-xxx",
        },
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Response shape
# ---------------------------------------------------------------------------


def test_chat_completions_response_shape(client_with_key: TestClient) -> None:
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _mock_provider("response text")

        resp = client_with_key.post(
            "/v1/chat/completions",
            headers=AUTH,
            json={"model": "gemini-3.1-pro-preview", "messages": VALID_MESSAGES},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["object"] == "chat.completion"
    assert body["model"] == "gemini-3.1-pro-preview"
    assert len(body["choices"]) == 1
    assert body["choices"][0]["message"]["content"] == "response text"


def test_chat_completions_uses_gateway_provider_defaults(
    client_with_key: TestClient,
) -> None:
    app.dependency_overrides[get_settings] = lambda: make_settings(
        model_provider="kilo-gateway",
        model_name=None,
        kilo_api_key="kilo-key",
    )

    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _mock_provider("gateway response")

        resp = client_with_key.post(
            "/v1/chat/completions",
            headers=AUTH,
            json={"model": "ignored-by-server-fallback", "messages": VALID_MESSAGES},
        )

    assert resp.status_code == 200
    call_args = mock_create.call_args
    assert call_args[0][0] == "kilo-gateway"
    assert call_args[1].get("api_key") == "kilo-key"
    assert call_args[1].get("base_url") == "https://api.kilo.ai/api/gateway"
    assert call_args[1].get("model") == "kilo-auto/balanced"


def test_chat_completions_uses_copilot_provider_defaults(
    client_with_key: TestClient,
) -> None:
    app.dependency_overrides[get_settings] = lambda: make_settings(
        model_provider="copilot",
        model_name=None,
        copilot_api_key="copilot-key",
    )

    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _mock_provider("copilot response")

        resp = client_with_key.post(
            "/v1/chat/completions",
            headers=AUTH,
            json={"model": "ignored-by-server-fallback", "messages": VALID_MESSAGES},
        )

    assert resp.status_code == 200
    call_args = mock_create.call_args
    assert call_args[0][0] == "copilot"
    assert call_args[1].get("api_key") == "copilot-key"
    assert call_args[1].get("base_url") == "https://api.githubcopilot.com"
    assert call_args[1].get("model") == "claude-sonnet-4.6"


def test_chat_completions_returns_upstream_http_errors(
    client_with_key: TestClient,
) -> None:
    provider = _mock_provider()
    request = httpx.Request(
        "POST",
        "https://api.githubcopilot.com/chat/completions",
    )
    response = httpx.Response(
        404,
        request=request,
        json={
            "error": {
                "message": (
                    'model "gpt-5.4" is not accessible via the /chat/completions'
                    " endpoint"
                )
            }
        },
    )
    provider.generate = AsyncMock(
        side_effect=httpx.HTTPStatusError(
            "upstream request failed",
            request=request,
            response=response,
        )
    )

    with patch("affine.api.server.ProviderFactory.create", return_value=provider):
        resp = client_with_key.post(
            "/v1/chat/completions",
            headers=AUTH,
            json={"model": "claude-sonnet-4.6", "messages": VALID_MESSAGES},
        )

    assert resp.status_code == 404
    assert (
        resp.json()["detail"]
        == 'model "gpt-5.4" is not accessible via the /chat/completions endpoint'
    )


def test_list_models_includes_gateway_presets(client_with_key: TestClient) -> None:
    resp = client_with_key.get("/v1/models", headers=AUTH)

    assert resp.status_code == 200
    model_ids = {item["id"] for item in resp.json()["data"]}
    assert "gemini-3.1-pro-preview" in model_ids
    assert "claude-sonnet-4.6" in model_ids
    assert "opencode/glm-5.1" in model_ids
    assert "kilo-auto/frontier" in model_ids
    assert "kilo-auto/balanced" in model_ids


# ---------------------------------------------------------------------------
# CORS Configuration logic
# ---------------------------------------------------------------------------


def test_cors_middleware_configuration() -> None:
    from affine.config.settings import get_settings
    from fastapi.middleware.cors import CORSMiddleware

    from affine.api.server import app

    settings = get_settings()

    cors_middleware = next(m for m in app.user_middleware if m.cls == CORSMiddleware)

    # Assert that allow_credentials is True and origins match settings
    assert cors_middleware.kwargs["allow_credentials"] is True
    assert cors_middleware.kwargs["allow_origins"] == settings.cors_allow_origins


# ---------------------------------------------------------------------------
# Agent chat
# ---------------------------------------------------------------------------


def _agent_provider(chunks: list[str]) -> MagicMock:
    async def _stream(*_args: object, **_kwargs: object):
        for chunk in chunks:
            yield chunk

    provider = _mock_provider()
    provider.stream = _stream
    return provider


def test_agent_chat_uses_header_provider(client_with_key: TestClient) -> None:
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _agent_provider(["hi", " there"])
        response = client_with_key.post(
            "/v1/agent/chat",
            headers=AUTH,
            json={
                "model": "claude-sonnet-4-6",
                "messages": VALID_MESSAGES,
                "x_provider": "anthropic",
                "x_provider_api_key": "user-anthropic-key",
            },
        )

    assert response.status_code == 200
    assert mock_create.call_args.args[0] == "anthropic"
    assert mock_create.call_args.kwargs["api_key"] == "user-anthropic-key"
    assert mock_create.call_args.kwargs["model"] == "claude-sonnet-4-6"
    assert response.text == (
        'data: {"type":"text_delta","text":"hi"}\n\n'
        'data: {"type":"text_delta","text":" there"}\n\n'
        'data: {"type":"done"}\n\n'
    )


def test_agent_chat_falls_back_to_server_provider(
    client_with_key: TestClient,
) -> None:
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _agent_provider([])
        response = client_with_key.post(
            "/v1/agent/chat",
            headers=AUTH,
            json={
                "model": "requested-model",
                "messages": VALID_MESSAGES,
                "x_provider": "anthropic",
            },
        )

    assert response.status_code == 200
    assert mock_create.call_args.args[0] == "gemini"
    assert mock_create.call_args.kwargs["api_key"] == "server-google-key"
    # "requested-model" belongs to anthropic, so the server provider must not get it.
    assert mock_create.call_args.kwargs["model"] == "gemini-3.1-pro-preview"


def test_agent_chat_keeps_request_model_for_server_provider(
    client_with_key: TestClient,
) -> None:
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _agent_provider([])
        response = client_with_key.post(
            "/v1/agent/chat",
            headers=AUTH,
            json={"model": "requested-model", "messages": VALID_MESSAGES},
        )

    assert response.status_code == 200
    assert mock_create.call_args.args[0] == "gemini"
    assert mock_create.call_args.kwargs["model"] == "requested-model"


# ---------------------------------------------------------------------------
# Live provider model listing
# ---------------------------------------------------------------------------


def _listing_provider(models: list[dict[str, str]] | Exception) -> MagicMock:
    provider = _mock_provider()
    if isinstance(models, Exception):
        provider.list_models = AsyncMock(side_effect=models)
    else:
        provider.list_models = AsyncMock(return_value=models)
    return provider


def test_post_models_requires_auth(client_with_key: TestClient) -> None:
    resp = client_with_key.post("/v1/models", json={})
    assert resp.status_code == 401


def test_post_models_returns_sorted_unique_models(
    client_with_key: TestClient,
) -> None:
    provider = _listing_provider(
        [
            {"id": "b-model", "name": "B"},
            {"id": "a-model", "name": "A"},
            {"id": "b-model", "name": "B"},
        ]
    )
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = provider
        resp = client_with_key.post(
            "/v1/models",
            headers=AUTH,
            json={"x_provider": "anthropic", "x_provider_api_key": "user-key"},
        )

    assert resp.status_code == 200
    assert resp.json() == {
        "data": [{"id": "a-model", "name": "A"}, {"id": "b-model", "name": "B"}]
    }
    assert mock_create.call_args.args[0] == "anthropic"
    assert mock_create.call_args.kwargs["api_key"] == "user-key"
    provider.aclose.assert_awaited_once()


def test_post_models_uses_server_provider_without_override(
    client_with_key: TestClient,
) -> None:
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _listing_provider([])
        resp = client_with_key.post("/v1/models", headers=AUTH, json={})

    assert resp.status_code == 200
    assert mock_create.call_args.args[0] == "gemini"
    assert mock_create.call_args.kwargs["api_key"] == "server-google-key"


def test_post_models_maps_upstream_error_to_502_without_key(
    client_with_key: TestClient,
) -> None:
    request = httpx.Request("GET", "https://example.test/models?key=user-key")
    response = httpx.Response(
        403, json={"error": {"message": "bad key user-key"}}, request=request
    )
    error = httpx.HTTPStatusError("denied", request=request, response=response)
    provider = _listing_provider(error)
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = provider
        resp = client_with_key.post(
            "/v1/models",
            headers=AUTH,
            json={"x_provider": "gemini", "x_provider_api_key": "user-key"},
        )

    assert resp.status_code == 502
    assert "user-key" not in resp.text
    assert "403" in resp.json()["detail"]
    provider.aclose.assert_awaited_once()


def test_post_models_maps_connection_error_to_502(
    client_with_key: TestClient,
) -> None:
    error = httpx.ConnectError("boom https://example.test/models?key=user-key")
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _listing_provider(error)
        resp = client_with_key.post(
            "/v1/models",
            headers=AUTH,
            json={"x_provider": "gemini", "x_provider_api_key": "user-key"},
        )

    assert resp.status_code == 502
    assert "user-key" not in resp.text


def test_post_models_returns_400_without_any_provider_key(
    client_with_key: TestClient,
) -> None:
    app.dependency_overrides[get_settings] = lambda: make_settings(google_api_key=None)
    resp = client_with_key.post("/v1/models", headers=AUTH, json={})

    assert resp.status_code == 400
    assert "No API key" in resp.json()["detail"]


def test_post_models_uses_server_key_for_requested_builtin_provider(
    client_with_key: TestClient,
) -> None:
    app.dependency_overrides[get_settings] = lambda: make_settings(
        model_provider="anthropic", anthropic_api_key=None
    )
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _listing_provider([])
        resp = client_with_key.post(
            "/v1/models", headers=AUTH, json={"x_provider": "gemini"}
        )
        evil = client_with_key.post(
            "/v1/models",
            headers=AUTH,
            json={"x_provider": "copilot", "x_provider_base_url": "https://evil"},
        )

    assert resp.status_code == 200
    assert mock_create.call_args_list[0].args[0] == "gemini"
    assert mock_create.call_args_list[0].kwargs["api_key"] == "server-google-key"
    assert evil.status_code == 200
    assert mock_create.call_args_list[1].kwargs["api_key"] == "server-copilot-key"
    assert mock_create.call_args_list[1].kwargs["base_url"] == (
        "https://api.githubcopilot.com"
    )


def test_post_models_returns_400_without_server_key_for_requested_provider(
    client_with_key: TestClient,
) -> None:
    app.dependency_overrides[get_settings] = lambda: make_settings(
        anthropic_api_key=None
    )
    resp = client_with_key.post(
        "/v1/models", headers=AUTH, json={"x_provider": "anthropic"}
    )

    assert resp.status_code == 400
    assert resp.json()["detail"] == (
        "No API key for provider 'anthropic'. "
        "Enter a provider key in Settings or configure one on the server."
    )


def test_post_models_maps_malformed_list_to_502(client_with_key: TestClient) -> None:
    provider = _listing_provider(AttributeError("'list' object has no attribute 'get'"))
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = provider
        resp = client_with_key.post("/v1/models", headers=AUTH, json={})

    assert resp.status_code == 502
    assert resp.json()["detail"] == "Provider returned an invalid model list"
    provider.aclose.assert_awaited_once()


def test_post_models_drops_non_string_ids(client_with_key: TestClient) -> None:
    models = [{"id": 7, "name": "seven"}, {"id": "a-model", "name": "A"}]
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _listing_provider(models)  # type: ignore[arg-type]
        resp = client_with_key.post("/v1/models", headers=AUTH, json={})

    assert resp.status_code == 200
    assert resp.json() == {"data": [{"id": "a-model", "name": "A"}]}


def test_post_models_caps_echoed_upstream_body(client_with_key: TestClient) -> None:
    request = httpx.Request("GET", "http://internal.test/models")
    response = httpx.Response(404, text="x" * 5000, request=request)
    error = httpx.HTTPStatusError("missing", request=request, response=response)
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _listing_provider(error)
        resp = client_with_key.post("/v1/models", headers=AUTH, json={})

    assert resp.status_code == 502
    assert resp.json()["detail"].count("x") <= 300


def test_post_models_redacts_key_before_truncating(client_with_key: TestClient) -> None:
    key = "user-secret-key-0123456789"
    request = httpx.Request("GET", "https://example.test/models")
    # The key straddles the 300-char cap; truncating first would leak a prefix.
    response = httpx.Response(400, text="x" * 290 + key, request=request)
    error = httpx.HTTPStatusError("bad", request=request, response=response)
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _listing_provider(error)
        resp = client_with_key.post(
            "/v1/models",
            headers=AUTH,
            json={"x_provider": "gemini", "x_provider_api_key": key},
        )

    assert resp.status_code == 502
    assert "user-secr" not in resp.text
