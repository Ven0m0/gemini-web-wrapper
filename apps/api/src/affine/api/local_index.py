"""FastAPI routes for local codebase indexing."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from affine.code_index import (
    CodeIndexer,
    CodeSearchEngine,
    CodeIndexStore,
)
from affine.api.utils import create_local_embedder
from affine.config.settings import Settings, get_settings

router = APIRouter(prefix="/v1/local-index", tags=["local-index"])


def get_embedder(settings: Settings):
    """Factory for embedder based on settings."""
    try:
        return create_local_embedder(settings)
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc


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
                signature=r.signature,
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


@router.post("/search/structural", response_model=LocalSearchResponse)
async def search_structural(
    request: LocalStructuralSearchRequest,
    settings: Settings = Depends(get_settings),
):
    """Structural search local codebase index.

    Performs literal search on symbol names, kinds, and code.
    Returns results matching filters.
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
    finally:
        await embedder.aclose()

    return LocalSearchResponse(
        query=f"structural:{request.name_pattern or ''}:{request.kind or ''}",
        results=[
            LocalSearchResult(
                path=r.path,
                kind=r.kind,
                name=r.name,
                signature=r.signature,
                code=r.code[:500],
                start_line=r.start_line,
                end_line=r.end_line,
                score=r.score,
                is_ast_node=r.is_ast_node,
                pattern=r.pattern,
            )
            for r in results
        ],
    )


@router.get("/outline/file", response_model=LocalOutlineResponse)
async def file_outline(
    path: str,
    settings: Settings = Depends(get_settings),
):
    """Get symbol outline for a specific file."""
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
        results = await engine.get_file_outline(path)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get file outline: {exc}",
        ) from exc
    finally:
        await embedder.aclose()

    return LocalOutlineResponse(
        path=path,
        results=[
            LocalSearchResult(
                path=r.path,
                kind=r.kind,
                name=r.name,
                signature=r.signature,
                code=r.code[:500],
                start_line=r.start_line,
                end_line=r.end_line,
                score=r.score,
                is_ast_node=r.is_ast_node,
                pattern=r.pattern,
            )
            for r in results
        ],
    )


@router.get("/outline/repo", response_model=LocalOutlineResponse)
async def repo_outline(
    k: int = 500,
    settings: Settings = Depends(get_settings),
):
    """Get repository symbol outline."""
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
        results = await engine.get_repo_outline(k=k)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get repo outline: {exc}",
        ) from exc
    finally:
        await embedder.aclose()

    return LocalOutlineResponse(
        results=[
            LocalSearchResult(
                path=r.path,
                kind=r.kind,
                name=r.name,
                signature=r.signature,
                code=r.code[:500],
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
