import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from server import app, state
import httpx

# Initialize client to trigger startup
client = TestClient(app)

@pytest.fixture
def mock_github_client():
    mock_client = AsyncMock(spec=httpx.AsyncClient)

    # We replace the real client in state with our mock
    # This works because get_github_client dependency reads from state
    original_client = state.github_client
    state.github_client = mock_client

    yield mock_client

    state.github_client = original_client

def test_github_read_file(mock_github_client):
    # Mock response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "content": "dGVzdA==",  # "test" in base64
        "encoding": "base64",
        "sha": "123"
    }
    mock_github_client.get.return_value = mock_response

    response = client.post("/github/file/read", json={
        "config": {
            "token": "fake-token",
            "owner": "fake-owner",
            "repo": "fake-repo",
            "branch": "main"
        },
        "path": "test.txt"
    })

    assert response.status_code == 200
    data = response.json()
    assert data["decoded_content"] == "test"
    assert data["sha"] == "123"

    # Verify call
    mock_github_client.get.assert_awaited_once()
    args, kwargs = mock_github_client.get.await_args
    assert "test.txt" in args[0]
    assert kwargs["headers"]["Authorization"] == "Bearer fake-token"

def test_github_write_file(mock_github_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "content": {"name": "test.txt"},
        "commit": {"message": "update"}
    }
    mock_github_client.put.return_value = mock_response

    response = client.post("/github/file/write", json={
        "config": {
            "token": "fake-token",
            "owner": "fake-owner",
            "repo": "fake-repo",
            "branch": "main"
        },
        "path": "test.txt",
        "content": "new content",
        "message": "update file"
    })

    assert response.status_code == 200

    # Verify call
    mock_github_client.put.assert_awaited_once()
    args, kwargs = mock_github_client.put.await_args
    assert kwargs["json"]["message"] == "update file"

def test_github_list_directory(mock_github_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {"name": "file1.txt", "type": "file"},
        {"name": "dir1", "type": "dir"}
    ]
    mock_github_client.get.return_value = mock_response

    response = client.post("/github/list", json={
        "config": {
            "token": "fake-token",
            "owner": "fake-owner",
            "repo": "fake-repo",
            "branch": "main"
        },
        "path": ""
    })

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2

def test_github_branches(mock_github_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {"name": "main"},
        {"name": "dev"}
    ]
    mock_github_client.get.return_value = mock_response

    response = client.post("/github/branches", json={
        "config": {
            "token": "fake-token",
            "owner": "fake-owner",
            "repo": "fake-repo"
        }
    })

    assert response.status_code == 200
    data = response.json()
    assert len(data["branches"]) == 2
