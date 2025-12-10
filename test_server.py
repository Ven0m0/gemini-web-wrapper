"""Comprehensive test suite for Gemini API server.

Tests cover:
- Health check endpoint
- Chat endpoint with system/user messages
- Code assistance endpoint
- Input validation and error handling
- Edge cases and boundary conditions
"""

import os
from collections.abc import Generator
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Mock environment before importing server to pass Settings validation
with patch.dict(os.environ, {"GOOGLE_API_KEY": "fake-key"}):
    from server import app, state


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a TestClient with a mocked model state.

    Yields:
        TestClient: Configured test client with mocked dependencies.
    """
    # Mock the model and its generate method
    mock_model = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "Mocked response"
    mock_model.generate.return_value = mock_response

    # Inject into global state
    state.model = mock_model
    state.genkit = MagicMock()

    with TestClient(app) as c:
        yield c

    # Cleanup
    state.model = None
    state.genkit = None


def test_health(client: TestClient) -> None:
    """Test health check endpoint returns 200 OK."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_chat_endpoint(client: TestClient) -> None:
    """Test chat endpoint with system and user messages."""
    payload = {"prompt": "Hello", "system": "Be nice"}
    response = client.post("/chat", json=payload)

    assert response.status_code == 200
    assert response.json() == {"text": "Mocked response"}

    # Verify model call with proper typing
    assert state.model is not None
    mock_model: Any = state.model  # Cast to Any for mock assertions
    mock_model.generate.assert_called_once()
    args = mock_model.generate.call_args[0][0]
    assert args == [
        {"role": "system", "content": "Be nice"},
        {"role": "user", "content": "Hello"},
    ]


def test_code_endpoint(client: TestClient) -> None:
    """Test code assistance endpoint formats prompt correctly."""
    payload = {"code": "print(1)", "instruction": "make it 2"}
    response = client.post("/code", json=payload)

    assert response.status_code == 200
    assert response.json() == {"text": "Mocked response"}

    # Verify model call
    assert state.model is not None
    mock_model: Any = state.model  # Cast to Any for mock assertions
    mock_model.generate.assert_called()
    args = mock_model.generate.call_args[0][0]
    assert "Instruction:\nmake it 2" in args
    assert "Code:\nprint(1)" in args


def test_validation_error(client: TestClient) -> None:
    """Test Pydantic validation rejects empty prompt."""
    response = client.post("/chat", json={"prompt": ""})  # Empty prompt
    assert response.status_code == 422  # Unprocessable Entity


def test_chat_without_system_message(client: TestClient) -> None:
    """Test chat endpoint works without optional system message."""
    payload = {"prompt": "What is Python?"}
    response = client.post("/chat", json=payload)

    assert response.status_code == 200
    assert response.json() == {"text": "Mocked response"}

    # Verify only user message is sent
    assert state.model is not None
    mock_model: Any = state.model
    args = mock_model.generate.call_args[0][0]
    assert len(args) == 1
    assert args[0] == {"role": "user", "content": "What is Python?"}


def test_chat_missing_prompt(client: TestClient) -> None:
    """Test chat endpoint rejects request without prompt field."""
    response = client.post("/chat", json={"system": "Be helpful"})
    assert response.status_code == 422


def test_code_missing_instruction(client: TestClient) -> None:
    """Test code endpoint rejects request without instruction."""
    response = client.post("/code", json={"code": "def foo(): pass"})
    assert response.status_code == 422


def test_code_empty_code(client: TestClient) -> None:
    """Test code endpoint rejects empty code field."""
    response = client.post(
        "/code", json={"code": "", "instruction": "add docs"}
    )
    assert response.status_code == 422


def test_model_not_initialized(client: TestClient) -> None:
    """Test endpoints return 503 when model is not initialized."""
    # Set model to None to simulate uninitialized state
    original_model = state.model
    state.model = None

    response = client.post("/chat", json={"prompt": "Hello"})
    assert response.status_code == 503
    assert "Model not initialized" in response.json()["detail"]

    # Restore model
    state.model = original_model


def test_long_prompt_handling(client: TestClient) -> None:
    """Test server handles long prompts correctly."""
    long_prompt = "a" * 10000  # 10k character prompt
    payload = {"prompt": long_prompt}
    response = client.post("/chat", json=payload)

    assert response.status_code == 200
    assert state.model is not None
    mock_model: Any = state.model
    args = mock_model.generate.call_args[0][0]
    assert args[0]["content"] == long_prompt


def test_special_characters_in_prompt(client: TestClient) -> None:
    """Test handling of special characters and unicode."""
    special_prompt = "Test: 你好 🚀 <script>alert('xss')</script>"
    payload = {"prompt": special_prompt}
    response = client.post("/chat", json=payload)

    assert response.status_code == 200
    assert state.model is not None
    mock_model: Any = state.model
    args = mock_model.generate.call_args[0][0]
    assert special_prompt in args[0]["content"]
