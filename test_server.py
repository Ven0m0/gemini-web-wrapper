"""Tests for FastAPI server.

Tests cover:
- Health check endpoint
- Chat endpoint with system/user messages
- Code assistance endpoint
- Chatbot endpoint with history + streaming
- Input validation and error handling
- Edge cases and boundary conditions
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Mock environment before importing server to pass Settings validation
with patch.dict(os.environ, {"GOOGLE_API_KEY": "fake-key"}):
    from server import app, state


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a TestClient with mocked provider state."""

    mock_provider = MagicMock()
    mock_provider.generate = AsyncMock(return_value="Mocked response")

    async def _stream_gen() -> AsyncGenerator[str, None]:
        yield "Mocked response"

    def _stream(
        prompt: str,
        system: str | None = None,
        history: list[dict[str, str]] | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        _ = (prompt, system, history, kwargs)
        return _stream_gen()

    mock_provider.stream = MagicMock(side_effect=_stream)

    mock_session_mgr = MagicMock()
    mock_session_mgr.attribution = MagicMock()
    mock_session_mgr.set_session = MagicMock()
    mock_session_mgr.new_session = MagicMock(return_value="test-session-id")

    @asynccontextmanager
    async def test_lifespan(_: Any) -> AsyncGenerator[None, None]:
        state.attribution_cache.clear()
        state.llm_provider = mock_provider
        state.session_manager = mock_session_mgr
        state.settings = MagicMock()
        state.cookie_manager = MagicMock()
        state.gemini_client = MagicMock()
        yield
        state.llm_provider = None
        state.session_manager = None
        state.settings = None
        state.cookie_manager = None
        state.gemini_client = None
        state.attribution_cache.clear()

    app.router.lifespan_context = test_lifespan  # type: ignore[assignment]

    with TestClient(app) as c:
        yield c


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_chat_endpoint(client: TestClient) -> None:
    payload = {"prompt": "Hello", "system": "Be nice"}
    response = client.post("/chat", json=payload)

    assert response.status_code == 200
    assert response.json() == {"text": "Mocked response"}

    assert state.llm_provider is not None
    model: Any = state.llm_provider
    model.generate.assert_awaited_once_with("Hello", system="Be nice", history=None)


def test_chat_without_system_message(client: TestClient) -> None:
    response = client.post("/chat", json={"prompt": "What is Python?"})

    assert response.status_code == 200
    assert response.json() == {"text": "Mocked response"}

    assert state.llm_provider is not None
    model: Any = state.llm_provider
    model.generate.assert_awaited_once_with(
        "What is Python?", system=None, history=None
    )


def test_chat_missing_prompt(client: TestClient) -> None:
    response = client.post("/chat", json={"system": "Be helpful"})
    assert response.status_code == 422


def test_validation_error(client: TestClient) -> None:
    response = client.post("/chat", json={"prompt": ""})
    assert response.status_code == 422


def test_code_endpoint(client: TestClient) -> None:
    payload = {"code": "print(1)", "instruction": "make it 2"}
    response = client.post("/code", json=payload)

    assert response.status_code == 200
    assert response.json() == {"text": "Mocked response"}

    assert state.llm_provider is not None
    model: Any = state.llm_provider
    args, kwargs = model.generate.await_args
    assert kwargs == {"system": None, "history": None}
    assert "Instruction:\nmake it 2" in args[0]
    assert "Code:\nprint(1)" in args[0]


def test_code_missing_instruction(client: TestClient) -> None:
    response = client.post("/code", json={"code": "def foo(): pass"})
    assert response.status_code == 422


def test_code_empty_code(client: TestClient) -> None:
    response = client.post("/code", json={"code": "", "instruction": "add docs"})
    assert response.status_code == 422


def test_model_not_initialized(client: TestClient) -> None:
    assert state.llm_provider is not None
    original_provider = state.llm_provider
    state.llm_provider = None

    response = client.post("/chat", json={"prompt": "Hello"})
    assert response.status_code == 503
    assert "not initialized" in response.json()["detail"].lower()

    state.llm_provider = original_provider


def test_long_prompt_handling(client: TestClient) -> None:
    long_prompt = "a" * 10000
    response = client.post("/chat", json={"prompt": long_prompt})

    assert response.status_code == 200

    assert state.llm_provider is not None
    model: Any = state.llm_provider
    model.generate.assert_awaited_once_with(long_prompt, system=None, history=None)


def test_special_characters_in_prompt(client: TestClient) -> None:
    special_prompt = "Test: 你好 🚀 <script>alert('xss')</script>"
    response = client.post("/chat", json={"prompt": special_prompt})

    assert response.status_code == 200

    assert state.llm_provider is not None
    model: Any = state.llm_provider
    args, _ = model.generate.await_args
    assert special_prompt == args[0]


def test_chatbot_endpoint_with_history(client: TestClient) -> None:
    payload = {
        "message": "What else?",
        "history": [
            {"role": "user", "content": "Tell me about Python"},
            {"role": "model", "content": "Python is a programming language"},
        ],
    }
    response = client.post("/chatbot", json=payload)

    assert response.status_code == 200
    assert response.json() == {"text": "Mocked response"}

    assert state.llm_provider is not None
    model: Any = state.llm_provider
    model.generate.assert_awaited_once_with(
        "What else?",
        system=None,
        history=[
            {"role": "user", "content": "Tell me about Python"},
            {"role": "model", "content": "Python is a programming language"},
        ],
    )


def test_chatbot_validation_empty_message(client: TestClient) -> None:
    response = client.post("/chatbot", json={"message": ""})
    assert response.status_code == 422


def test_chatbot_validation_missing_message(client: TestClient) -> None:
    response = client.post("/chatbot", json={"history": []})
    assert response.status_code == 422


def test_chatbot_validation_invalid_role(client: TestClient) -> None:
    payload = {
        "message": "Hello",
        "history": [{"role": "invalid", "content": "test"}],
    }
    response = client.post("/chatbot", json=payload)
    assert response.status_code == 422


def test_chatbot_stream_endpoint(client: TestClient) -> None:
    payload = {"message": "Tell me a story", "system": "You are a storyteller"}
    response = client.post("/chatbot/stream", json=payload)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert "Mocked response" in response.text

    assert state.llm_provider is not None
    model: Any = state.llm_provider
    model.stream.assert_called_once_with(
        "Tell me a story",
        system="You are a storyteller",
        history=None,
    )


def test_chatbot_stream_includes_system_and_history(client: TestClient) -> None:
    payload = {
        "message": "Continue",
        "system": "You are a storyteller",
        "history": [
            {"role": "user", "content": "Start a story"},
            {"role": "model", "content": "Once upon a time..."},
        ],
        "user_id": "test_user",
    }
    response = client.post("/chatbot/stream", json=payload)

    assert response.status_code == 200

    assert state.llm_provider is not None
    model: Any = state.llm_provider
    model.stream.assert_called_once_with(
        "Continue",
        system="You are a storyteller",
        history=[
            {"role": "user", "content": "Start a story"},
            {"role": "model", "content": "Once upon a time..."},
        ],
    )

    assert state.session_manager is not None
    session_mgr: Any = state.session_manager
    assert session_mgr.attribution.call_count == 1


def test_chatbot_stream_not_initialized(client: TestClient) -> None:
    assert state.llm_provider is not None
    original_provider = state.llm_provider
    state.llm_provider = None

    response = client.post("/chatbot/stream", json={"message": "Hello"})
    assert response.status_code == 503

    state.llm_provider = original_provider
