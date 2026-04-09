from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from affine.config.settings import Settings, get_settings
from affine.shared.repo_index_schemas import (
    RepoIndexRequest,
    RepoIndexStatus,
    RepoSearchRequest,
    RepoSearchResponse,
)

from .repo_indexing import RepositoryIndexService

router = APIRouter(prefix="/v1/repo", tags=["repo-index"])


@router.post("/index", response_model=RepoIndexStatus)
async def index_repository(
    request: RepoIndexRequest,
    settings: Settings = Depends(get_settings),
) -> RepoIndexStatus:
    service = RepositoryIndexService(settings)
    try:
        return await service.index_repository(request)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("/index/status", response_model=RepoIndexStatus)
async def repo_index_status(
    owner: str = Query(min_length=1),
    repo: str = Query(min_length=1),
    branch: str = Query(default="main", min_length=1),
    settings: Settings = Depends(get_settings),
) -> RepoIndexStatus:
    service = RepositoryIndexService(settings)
    status_result = service.get_status(owner=owner, repo=repo, branch=branch)
    if status_result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository index not found",
        )
    return status_result


@router.post("/search", response_model=RepoSearchResponse)
async def search_repository(
    request: RepoSearchRequest,
    settings: Settings = Depends(get_settings),
) -> RepoSearchResponse:
    service = RepositoryIndexService(settings)
    return service.search_repository(request)
