from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from affine.api.server import app
from affine.api.repo_indexing import GitHubRepositoryClient, GitHubTreeEntry
from affine.config.settings import Settings, get_settings

AUTH = {"Authorization": "Bearer server-gate-key"}


class FakeGitHubRepositoryClient(GitHubRepositoryClient):
    def __init__(self, *, token: str, owner: str, repo: str) -> None:
        super().__init__(token=token, owner=owner, repo=repo)
        self._files = {
            "blob-py": "class Greeter:\n    def greet(self, name: str) -> str:\n        return f'hello {name}'\n",
            "blob-rs": "pub struct Engine {\n    power: u32,\n}\n\npub fn start() {}\n",
            "blob-md": "# Notes\n\nThis file should still index as text but has no symbols.\n",
        }

    async def list_tree(self, branch: str) -> list[GitHubTreeEntry]:
        return [
            GitHubTreeEntry(path="src/greeter.py", sha="blob-py", size=88),
            GitHubTreeEntry(path="src/lib.rs", sha="blob-rs", size=63),
            GitHubTreeEntry(path="README.md", sha="blob-md", size=65),
        ]

    async def get_blob_text(self, sha: str) -> str:
        return self._files[sha]


def make_settings(tmp_path: Path, **kwargs: object) -> Settings:
    defaults: dict[str, object] = dict(
        api_key="server-gate-key",
        google_api_key="server-google-key",
        model_provider="gemini",
        repo_index_db_path=tmp_path / "repo-index.db",
    )
    defaults.update(kwargs)
    return Settings(**defaults)


def test_repo_index_round_trip(tmp_path: Path, monkeypatch) -> None:
    app.dependency_overrides[get_settings] = lambda: make_settings(tmp_path)
    monkeypatch.setattr(
        "affine.api.repo_indexing.GitHubRepositoryClient",
        FakeGitHubRepositoryClient,
    )

    client = TestClient(app)
    try:
        index_response = client.post(
            "/v1/repo/index",
            headers=AUTH,
            json={
                "owner": "octo",
                "repo": "demo",
                "branch": "main",
                "github_token": "ghp_test",
            },
        )
        assert index_response.status_code == 200
        indexed = index_response.json()
        assert indexed["status"] == "indexed"
        assert indexed["indexed_files"] == 3
        assert indexed["symbol_count"] >= 3
        assert set(indexed["lsp_servers"].keys()) == {"bash", "python", "rust"}

        status_response = client.get(
            "/v1/repo/index/status",
            headers=AUTH,
            params={"owner": "octo", "repo": "demo", "branch": "main"},
        )
        assert status_response.status_code == 200
        assert status_response.json()["status"] == "indexed"

        search_response = client.post(
            "/v1/repo/search",
            headers=AUTH,
            json={
                "owner": "octo",
                "repo": "demo",
                "branch": "main",
                "query": "greet function",
                "path": "src",
                "limit": 5,
            },
        )
        assert search_response.status_code == 200
        payload = search_response.json()
        assert payload["indexed"] is True
        assert payload["results"]
        assert payload["results"][0]["path"] == "src/greeter.py"
        assert payload["results"][0]["name"] == "greet"
    finally:
        app.dependency_overrides.clear()


def test_repo_search_requires_existing_index(tmp_path: Path) -> None:
    app.dependency_overrides[get_settings] = lambda: make_settings(tmp_path)
    client = TestClient(app)
    try:
        response = client.post(
            "/v1/repo/search",
            headers=AUTH,
            json={
                "owner": "octo",
                "repo": "demo",
                "branch": "main",
                "query": "greet",
            },
        )
        assert response.status_code == 200
        assert response.json() == {
            "owner": "octo",
            "repo": "demo",
            "branch": "main",
            "query": "greet",
            "indexed": False,
            "results": [],
        }
    finally:
        app.dependency_overrides.clear()
