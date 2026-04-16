"""FastAPI routes for local codebase indexing."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from affine.code_index import (
    CodeIndexer,
    CodeSearchEngine,
    CodeIndexStore,
    EmbedderFactory,
)
from affine.config.settings import Settings, get_settings

router = APIRouter(prefix="/v1/local-index", tags=["local-index"])


def get_embedder(settings: Settings):
    """Factory for embedder based on settings."""
    provider = settings.model_provider
    api_key = settings.provider_api_key()
    base_url = settings.provider_base_url()

    if provider == "gemini" and settings.google_api_key:
        return EmbedderFactory.create(
            provider="gemini",
            api_key=settings.google_api_key,
        )
    elif api_key:
        return EmbedderFactory.create(
            provider="openai",
            api_key=api_key,
            base_url=base_url,
        )
    raise HTTPException(
        status_code=500,
        detail="No API key configured for embeddings",
    )


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


class LocalSearchResult(BaseModel):
    """Single search result."""

    path: str
    kind: str
    name: str
    code: str
    start_line: int
    end_line: int
    score: float
    is_ast_node: bool
    pattern: str | None = None


class LocalSearchResponse(BaseModel):
    """Response from search operation."""

    query: str
    results: list[LocalSearchResult]


class LocalStatsResponse(BaseModel):
    """Response with index statistics."""

    total_records: int
    indexed_files: int


@router.post("/index", response_model=LocalIndexResponse)
async def index_local(
    request: LocalIndexRequest,
    settings: Settings = Depends(get_settings),
):
    """Index local codebase.

    Scans the specified directory, extracts AST nodes and chunks,
    generates embeddings, and stores in LanceDB.
    """
    try:
        embedder = get_embedder(settings)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize embedder: {exc}",
        ) from exc

    db_path = settings.repo_index_db_path.parent / "lancedb"

    indexer = CodeIndexer(
        root=Path(request.root).resolve(),
        embedder=embedder,
        db_path=db_path,
    )
    await indexer.initialize()

    try:
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
    try:
        embedder = get_embedder(settings)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize embedder: {exc}",
        ) from exc

    db_path = settings.repo_index_db_path.parent / "lancedb"

    store = CodeIndexStore(db_path, embedder.dimension)
    await store.initialize()

    engine = CodeSearchEngine(store, embedder)

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
    finally:
        await embedder.aclose()

    return LocalSearchResponse(
        query=request.query,
        results=[
            LocalSearchResult(
                path=r.path,
                kind=r.kind,
                name=r.name,
                code=r.code[:500],  # Truncate for response
                start_line=r.start_line,
                end_line=r.end_line,
                score=r.score,
                is_ast_node=r.is_ast_node,
                pattern=r.pattern,
            )
            for r in results
        ],
    )


@router.get("/stats", response_model=LocalStatsResponse)
async def index_stats(
    settings: Settings = Depends(get_settings),
):
    """Get local index statistics."""
    try:
        embedder = get_embedder(settings)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize embedder: {exc}",
        ) from exc

    db_path = settings.repo_index_db_path.parent / "lancedb"

    store = CodeIndexStore(db_path, embedder.dimension)
    await store.initialize()

    try:
        stats = await store.get_stats()
        hashes = await store.get_indexed_file_hashes()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get stats: {exc}",
        ) from exc
    finally:
        await embedder.aclose()

    return LocalStatsResponse(
        total_records=stats.get("total_records", 0),
        indexed_files=len(hashes),
    )
