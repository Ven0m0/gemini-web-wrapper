import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Mock environment before importing server to pass Settings validation
with patch.dict(os.environ, {"GOOGLE_API_KEY": "fake-key"}):
    from server import app, state


@pytest.fixture
def client():
    """Create a TestClient with a mocked model state."""
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


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_chat_endpoint(client):
    payload = {"prompt": "Hello", "system": "Be nice"}
    response = client.post("/chat", json=payload)

    assert response.status_code == 200
    assert response.json() == {"text": "Mocked response"}

    # Verify model call
    state.model.generate.assert_called_once()
    args = state.model.generate.call_args[0][0]
    assert args == [{"role": "system", "content": "Be nice"}, {"role": "user", "content": "Hello"}]


def test_code_endpoint(client):
    payload = {"code": "print(1)", "instruction": "make it 2"}
    response = client.post("/code", json=payload)

    assert response.status_code == 200
    assert response.json() == {"text": "Mocked response"}

    # Verify model call
    state.model.generate.assert_called()
    args = state.model.generate.call_args[0][0]
    assert "Instruction:\nmake it 2" in args
    assert "Code:\nprint(1)" in args


def test_validation_error(client):
    """Test strict type validation from Pydantic."""
    response = client.post("/chat", json={"prompt": ""})  # Empty prompt
    assert response.status_code == 422  # Unprocessable Entity
