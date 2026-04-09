from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


RepoIndexState = Literal["idle", "indexing", "indexed", "error"]


class RepoRef(BaseModel):
    owner: str
    repo: str
    branch: str = "main"


class RepoIndexRequest(RepoRef):
    github_token: str = Field(min_length=1)
    force: bool = False
    max_files: int | None = Field(default=None, ge=1, le=5000)


class RepoIndexStatus(RepoRef):
    status: RepoIndexState
    indexed_files: int = 0
    skipped_files: int = 0
    symbol_count: int = 0
    last_indexed_at: datetime | None = None
    last_error: str | None = None
    lsp_servers: dict[str, bool] = Field(default_factory=dict)


class RepoSearchRequest(RepoRef):
    query: str = Field(min_length=1)
    path: str | None = None
    limit: int = Field(default=10, ge=1, le=50)


class RepoSearchResult(BaseModel):
    path: str
    language: str | None = None
    kind: str
    name: str
    start_line: int
    end_line: int
    score: float
    snippet: str


class RepoSearchResponse(RepoRef):
    query: str
    indexed: bool
    results: list[RepoSearchResult]
