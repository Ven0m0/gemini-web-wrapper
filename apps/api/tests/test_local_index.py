from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from affine.api.server import app
from affine.config.settings import Settings, get_settings
from affine.code_index.search import SearchResult

# Define authentication headers
AUTH = {"Authorization": "Bearer server-gate-key"}


def make_settings(tmp_path: Path, **kwargs: object) -> Settings:
    defaults: dict[str, object] = dict(
        api_key="server-gate-key",
        google_api_key="server-google-key",
        model_provider="gemini",
        repo_index_db_path=tmp_path / "repo-index.db",
    )
    defaults.update(kwargs)
    return Settings(**defaults)


def test_file_outline_success(tmp_path: Path) -> None:
    app.dependency_overrides[get_settings] = lambda: make_settings(tmp_path)

    mock_embedder = MagicMock()
    mock_embedder.dimension = 768
    mock_embedder.aclose = AsyncMock()

    mock_engine_instance = MagicMock()
    # Mock engine.get_file_outline return
    mock_engine_instance.get_file_outline = AsyncMock(
        return_value=[
            SearchResult(
                path="src/main.py",
                kind="function",
                name="main",
                signature="def main() -> None:",
                code="def main() -> None:\n    pass\n"
                * 100,  # Ensure it is > 500 chars to test truncating
                start_line=1,
                end_line=2,
                score=1.0,
                is_ast_node=True,
                pattern=None,
            )
        ]
    )

    with (
        patch("affine.api.local_index.get_embedder", return_value=mock_embedder),
        patch("affine.api.local_index.CodeIndexStore") as mock_store_cls,
        patch(
            "affine.api.local_index.CodeSearchEngine", return_value=mock_engine_instance
        ),
    ):
        mock_store_instance = MagicMock()
        mock_store_instance.initialize = AsyncMock()
        mock_store_cls.return_value = mock_store_instance

        client = TestClient(app)
        try:
            response = client.get(
                "/v1/local-index/outline/file",
                headers=AUTH,
                params={"path": "src/main.py"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["path"] == "src/main.py"
            assert len(data["results"]) == 1
            res = data["results"][0]
            assert res["name"] == "main"
            assert res["kind"] == "function"
            assert res["signature"] == "def main() -> None:"
            assert len(res["code"]) == 500

            mock_embedder.aclose.assert_awaited_once()
            mock_store_instance.initialize.assert_awaited_once()
            mock_engine_instance.get_file_outline.assert_awaited_once_with(
                "src/main.py"
            )
        finally:
            app.dependency_overrides.clear()


def test_file_outline_get_embedder_http_exception(tmp_path: Path) -> None:
    app.dependency_overrides[get_settings] = lambda: make_settings(tmp_path)

    # Mock get_embedder to raise HTTPException
    with patch(
        "affine.api.local_index.get_embedder",
        side_effect=HTTPException(status_code=400, detail="Bad config"),
    ):
        client = TestClient(app)
        try:
            response = client.get(
                "/v1/local-index/outline/file",
                headers=AUTH,
                params={"path": "src/main.py"},
            )
            assert response.status_code == 400
            assert response.json() == {"detail": "Bad config"}
        finally:
            app.dependency_overrides.clear()


def test_file_outline_get_embedder_general_exception(tmp_path: Path) -> None:
    app.dependency_overrides[get_settings] = lambda: make_settings(tmp_path)

    # Mock get_embedder to raise general exception
    with patch(
        "affine.api.local_index.get_embedder", side_effect=ValueError("Invalid key")
    ):
        client = TestClient(app)
        try:
            response = client.get(
                "/v1/local-index/outline/file",
                headers=AUTH,
                params={"path": "src/main.py"},
            )
            assert response.status_code == 500
            assert (
                "Failed to initialize embedder: Invalid key"
                in response.json()["detail"]
            )
        finally:
            app.dependency_overrides.clear()


def test_file_outline_engine_exception(tmp_path: Path) -> None:
    app.dependency_overrides[get_settings] = lambda: make_settings(tmp_path)

    mock_embedder = MagicMock()
    mock_embedder.dimension = 768
    mock_embedder.aclose = AsyncMock()

    mock_engine_instance = MagicMock()
    # Mock engine.get_file_outline to raise an exception
    mock_engine_instance.get_file_outline = AsyncMock(
        side_effect=RuntimeError("Search failed")
    )

    with (
        patch("affine.api.local_index.get_embedder", return_value=mock_embedder),
        patch("affine.api.local_index.CodeIndexStore") as mock_store_cls,
        patch(
            "affine.api.local_index.CodeSearchEngine", return_value=mock_engine_instance
        ),
    ):
        mock_store_instance = MagicMock()
        mock_store_instance.initialize = AsyncMock()
        mock_store_cls.return_value = mock_store_instance

        client = TestClient(app)
        try:
            response = client.get(
                "/v1/local-index/outline/file",
                headers=AUTH,
                params={"path": "src/main.py"},
            )
            assert response.status_code == 500
            assert (
                "Failed to get file outline: Search failed" in response.json()["detail"]
            )

            mock_embedder.aclose.assert_awaited_once()
        finally:
            app.dependency_overrides.clear()
