from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from affine.code_index import GeminiEmbedder, OpenAIEmbedder
from affine.code_index.embedder import VoyageEmbedder
from affine.code_index.search import SearchResult
from affine.config.settings import Settings, get_settings
from fastapi.testclient import TestClient

from affine.api.local_index import create_local_embedder
from affine.api.server import app

# Define authentication headers
AUTH = {"Authorization": "Bearer server-gate-key"}


def make_settings(tmp_path: Path, **kwargs: object) -> Settings:
    defaults: dict[str, object] = {
        "api_key": "server-gate-key",
        "google_api_key": "server-google-key",
        "model_provider": "gemini",
        "repo_index_db_path": tmp_path / "repo-index.db",
    }
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
        patch(
            "affine.api.local_index.create_local_embedder", return_value=mock_embedder
        ),
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


def test_file_outline_embedder_config_error(tmp_path: Path) -> None:
    app.dependency_overrides[get_settings] = lambda: make_settings(tmp_path)

    with patch(
        "affine.api.local_index.create_local_embedder",
        side_effect=ValueError("Invalid key"),
    ):
        client = TestClient(app)
        try:
            response = client.get(
                "/v1/local-index/outline/file",
                headers=AUTH,
                params={"path": "src/main.py"},
            )
            assert response.status_code == 500
            assert response.json() == {
                "detail": "Failed to initialize embedder: Invalid key"
            }
        finally:
            app.dependency_overrides.clear()


def test_create_local_embedder_selection(tmp_path: Path) -> None:
    anthropic = make_settings(
        tmp_path, model_provider="anthropic", anthropic_api_key="a-key"
    )
    with pytest.raises(ValueError, match="EMBEDDING_PROVIDER=voyage"):
        create_local_embedder(anthropic)

    voyage = anthropic.model_copy(
        update={"embedding_provider": "voyage", "voyage_api_key": "v-key"}
    )
    assert isinstance(create_local_embedder(voyage), VoyageEmbedder)

    assert isinstance(create_local_embedder(make_settings(tmp_path)), GeminiEmbedder)

    copilot = make_settings(tmp_path, model_provider="copilot", copilot_api_key="c-key")
    assert isinstance(create_local_embedder(copilot), OpenAIEmbedder)


def test_explicit_embedding_provider_is_authoritative(tmp_path: Path) -> None:
    gemini = make_settings(tmp_path, embedding_provider="openai")
    assert isinstance(create_local_embedder(gemini), OpenAIEmbedder)

    forced_gemini = make_settings(
        tmp_path,
        model_provider="copilot",
        copilot_api_key="c",
        embedding_provider="gemini",
    )
    assert isinstance(create_local_embedder(forced_gemini), GeminiEmbedder)

    forced_openai = make_settings(
        tmp_path,
        model_provider="anthropic",
        anthropic_api_key="a-key",
        embedding_provider="openai",
    )
    assert isinstance(create_local_embedder(forced_openai), OpenAIEmbedder)


def test_open_engine_maps_any_embedder_error(tmp_path: Path) -> None:
    app.dependency_overrides[get_settings] = lambda: make_settings(tmp_path)
    with patch(
        "affine.api.local_index.create_local_embedder",
        side_effect=RuntimeError("boom"),
    ):
        try:
            response = TestClient(app).get(
                "/v1/local-index/outline/file",
                headers=AUTH,
                params={"path": "src/main.py"},
            )
        finally:
            app.dependency_overrides.clear()
    assert response.status_code == 500
    assert response.json() == {"detail": "Failed to initialize embedder: boom"}


@pytest.mark.parametrize("command", ["search", "stats"])
def test_cli_embedder_failure_exits_cleanly(
    tmp_path: Path, command: str, caplog: pytest.LogCaptureFixture
) -> None:
    import argparse
    import asyncio

    from affine.api import local_index_cli

    args = argparse.Namespace(db=None, query="q", k=1, path=None, no_ast=False)
    settings = make_settings(tmp_path)
    with (
        patch.object(local_index_cli, "get_settings", return_value=settings),
        patch(
            "affine.api.local_index.create_local_embedder",
            side_effect=RuntimeError("boom"),
        ),
    ):
        fn = getattr(local_index_cli, f"{command}_command")
        assert asyncio.run(fn(args)) == 1
    assert "Failed to initialize embedder: boom" in caplog.text


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
        patch(
            "affine.api.local_index.create_local_embedder", return_value=mock_embedder
        ),
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
