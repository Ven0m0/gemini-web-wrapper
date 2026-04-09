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

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from affine.api.server import app
from affine.config.settings import Settings, get_settings

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_MESSAGES = [{"role": "user", "content": "hello"}]


def make_settings(**kwargs: object) -> Settings:
    defaults: dict[str, object] = dict(
        api_key="server-gate-key",
        google_api_key="server-google-key",
        anthropic_api_key="server-anthropic-key",
        model_provider="gemini",
        model_name=None,
    )
    defaults.update(kwargs)
    return Settings(**defaults)


def _mock_provider(return_text: str = "ok") -> MagicMock:
    provider = MagicMock()
    provider.generate = AsyncMock(return_value=return_text)
    provider.stream = MagicMock()
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
        json={"model": "gemini-2.5-flash", "messages": VALID_MESSAGES},
    )
    assert resp.status_code == 401


def test_chat_completions_open_mode_no_auth_required(
    client_open: TestClient,
) -> None:
    with patch("affine.api.server.ProviderFactory.create") as mock_create:
        mock_create.return_value = _mock_provider("hi")
        resp = client_open.post(
            "/v1/chat/completions",
            json={
                "model": "gemini-2.5-flash",
                "messages": VALID_MESSAGES,
                "x_provider": "gemini",
                "x_provider_api_key": "user-gemini-key",
            },
        )
    assert resp.status_code == 200


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
            json={"model": "gemini-2.5-flash", "messages": VALID_MESSAGES},
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
                "model": "gemini-2.5-flash",
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
                "model": "gemini-2.5-flash",
                "messages": VALID_MESSAGES,
                "x_provider": "gemini",
                # no x_provider_api_key → falls back to server config
            },
        )

    assert resp.status_code == 200
    call_args = mock_create.call_args
    # Should have used the server google key, not a user key
    assert call_args[1].get("api_key") == "server-google-key"


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
            json={"model": "gemini-2.5-flash", "messages": VALID_MESSAGES},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["object"] == "chat.completion"
    assert body["model"] == "gemini-2.5-flash"
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


def test_list_models_includes_gateway_presets(client_with_key: TestClient) -> None:
    resp = client_with_key.get("/v1/models", headers=AUTH)

    assert resp.status_code == 200
    model_ids = {item["id"] for item in resp.json()["data"]}
    assert "opencode/gpt-5.4" in model_ids
    assert "kilo-auto/frontier" in model_ids
    assert "kilo-auto/balanced" in model_ids
