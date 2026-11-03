"""FastAPI routes for local codebase indexing."""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator, Sequence
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from affine.code_index import (
    CodeIndexer,
    CodeIndexStore,
    CodeSearchEngine,
    Embedder,
    EmbedderFactory,
    SearchResult,
)
from affine.config.settings import Settings, get_settings

router = APIRouter(prefix="/v1/local-index", tags=["local-index"])

RESULT_CODE_LIMIT = 500


def create_local_embedder(settings: Settings) -> Embedder:
    """Create an embedder from settings; the chat provider only supplies keys."""
    choice = settings.embedding_provider
    auto = choice == "auto"
    if choice == "voyage" or (auto and settings.model_provider == "voyage"):
        if not settings.voyage_api_key:
            raise ValueError("No Voyage API key configured for embedding")
        return EmbedderFactory.create(
            provider="voyage", api_key=settings.voyage_api_key
        )
    if choice == "gemini" or (
        auto and settings.model_provider == "gemini" and settings.google_api_key
    ):
        if not settings.google_api_key:
            raise ValueError("No Google API key configured for embedding")
        return EmbedderFactory.create(
            provider="gemini", api_key=settings.google_api_key
        )
    if auto and settings.model_provider == "anthropic":
        raise ValueError(
            "Anthropic has no embeddings API; set EMBEDDING_PROVIDER=voyage"
        )
    api_key = settings.provider_api_key()
    if api_key:
        return EmbedderFactory.create(
            provider="openai",
            api_key=api_key,
            base_url=settings.provider_base_url(),
        )
    raise ValueError("No API key configured for embedding")


@asynccontextmanager
async def open_engine(
    settings: Settings,
) -> AsyncGenerator[tuple[CodeIndexStore, CodeSearchEngine]]:
    """Yield an initialized store and search engine; always closes the embedder."""
    try:
        embedder = create_local_embedder(settings)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to initialize embedder: {exc}"
        ) from exc
    try:
        store = CodeIndexStore(settings.local_index_db_path, embedder.dimension)
        await store.initialize()
        yield store, CodeSearchEngine(store, embedder)
    finally:
        await embedder.aclose()


class LocalIndexRequest(BaseModel):
    """Request to index local codebase."""

    root: str = Field(
        default=".",
        description="Root directory to index",
    )
    force: bool = Field(
        default=False,
        description="Force re-index",
    )


class LocalIndexResponse(BaseModel):
    """Response from indexing operation."""

    status: str
    files: int
    ast_nodes: int
    chunks: int
    errors: int


class LocalSearchRequest(BaseModel):
    """Request to search local codebase."""

    query: str = Field(
        ...,
        min_length=1,
        description="Search query",
    )
    k: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Number of results",
    )
    path_prefix: str | None = Field(
        default=None,
        description="Path prefix filter",
    )
    prefer_ast: bool = Field(
        default=True,
        description="Prefer AST nodes over chunks",
    )


class LocalStructuralSearchRequest(BaseModel):
    """Request to structural search local codebase."""

    kind: str | None = Field(
        default=None,
        description="Symbol kind filter",
    )
    name_pattern: str | None = Field(
        default=None,
        description="Name pattern filter",
    )
    code_pattern: str | None = Field(
        default=None,
        description="Code pattern filter",
    )
    path_prefix: str | None = Field(
        default=None,
        description="Path prefix filter",
    )
    k: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Number of results",
    )


class LocalSearchResult(BaseModel):
    """Single search result."""

    model_config = ConfigDict(from_attributes=True)

    path: str
    kind: str
    name: str
    code: str
    start_line: int
    end_line: int
    signature: str | None = None
    score: float
    is_ast_node: bool
    pattern: str | None = None


class LocalOutlineResponse(BaseModel):
    """Response with repository or file outline."""

    path: str | None = None
    results: list[LocalSearchResult]


class LocalSearchResponse(BaseModel):
    """Response from search operation."""

    query: str
    results: list[LocalSearchResult]


class LocalStatsResponse(BaseModel):
    """Response with index statistics."""

    total_records: int
    indexed_files: int


def _to_results(rows: Sequence[SearchResult]) -> list[LocalSearchResult]:
    results = [LocalSearchResult.model_validate(r) for r in rows]
    for r in results:
        r.code = r.code[:RESULT_CODE_LIMIT]
    return results


@router.post("/index", response_model=LocalIndexResponse)
async def index_local(
    request: LocalIndexRequest,
    settings: Settings = Depends(get_settings),
):
    """Index local codebase.

    Scans the specified directory, extracts AST nodes and chunks,
    generates embeddings, and stores in LanceDB.
    """
    # Securely validate that the requested root is within the current workspace.
    # realpath resolves symlinks and '..' before the commonpath check.
    try:
        workspace_path = os.path.realpath(os.getcwd())
        requested_path = os.path.realpath(request.root)
        if os.path.commonpath([workspace_path, requested_path]) != workspace_path:
            raise HTTPException(
                status_code=400,
                detail=f"Root directory {request.root} is outside the allowed workspace",
            )
        root_path = Path(requested_path)
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(
            status_code=400,
            detail=f"Invalid root directory: {exc}",
        ) from exc

    try:
        embedder = create_local_embedder(settings)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to initialize embedder: {exc}"
        ) from exc

    try:
        indexer = CodeIndexer(
            root=root_path,
            embedder=embedder,
            db_path=settings.local_index_db_path,
        )
        await indexer.initialize()
        result = await indexer.index(force=request.force)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Indexing failed: {exc}",
        ) from exc
    finally:
        await embedder.aclose()

    return LocalIndexResponse(
        status=result["status"],
        files=result.get("files", 0),
        ast_nodes=result.get("ast_nodes", 0),
        chunks=result.get("chunks", 0),
        errors=result.get("errors", 0),
    )


@router.post("/search", response_model=LocalSearchResponse)
async def search_local(
    request: LocalSearchRequest,
    settings: Settings = Depends(get_settings),
):
    """Search local codebase index.

    Performs semantic search using embeddings stored in LanceDB.
    Returns AST nodes and chunks ranked by relevance.
    """
    async with open_engine(settings) as (_, engine):
        try:
            results = await engine.search(
                query=request.query,
                k=request.k,
                path_prefix=request.path_prefix,
                prefer_ast=request.prefer_ast,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Search failed: {exc}",
            ) from exc

    return LocalSearchResponse(query=request.query, results=_to_results(results))


@router.post("/search/structural", response_model=LocalSearchResponse)
async def search_structural(
    request: LocalStructuralSearchRequest,
    settings: Settings = Depends(get_settings),
):
    """Structural search local codebase index.

    Performs literal search on symbol names, kinds, and code.
    Returns results matching filters.
    """
    async with open_engine(settings) as (_, engine):
        try:
            results = await engine.search_structural(
                kind=request.kind,
                name_pattern=request.name_pattern,
                code_pattern=request.code_pattern,
                path_prefix=request.path_prefix,
                k=request.k,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Structural search failed: {exc}",
            ) from exc

    return LocalSearchResponse(
        query=f"structural:{request.name_pattern or ''}:{request.kind or ''}",
        results=_to_results(results),
    )


@router.get("/outline/file", response_model=LocalOutlineResponse)
async def file_outline(
    path: str,
    settings: Settings = Depends(get_settings),
):
    """Get symbol outline for a specific file."""
    async with open_engine(settings) as (_, engine):
        try:
            results = await engine.get_file_outline(path)
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get file outline: {exc}",
            ) from exc

    return LocalOutlineResponse(path=path, results=_to_results(results))


@router.get("/outline/repo", response_model=LocalOutlineResponse)
async def repo_outline(
    k: int = 500,
    settings: Settings = Depends(get_settings),
):
    """Get repository symbol outline."""
    async with open_engine(settings) as (_, engine):
        try:
            results = await engine.get_repo_outline(k=k)
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get repo outline: {exc}",
            ) from exc

    return LocalOutlineResponse(results=_to_results(results))


@router.get("/stats", response_model=LocalStatsResponse)
async def index_stats(
    settings: Settings = Depends(get_settings),
):
    """Get local index statistics."""
    async with open_engine(settings) as (store, _):
        try:
            stats = await store.get_stats()
            hashes = await store.get_indexed_file_hashes()
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get stats: {exc}",
            ) from exc

    return LocalStatsResponse(
        total_records=stats.get("total_records", 0),
        indexed_files=len(hashes),
    )
