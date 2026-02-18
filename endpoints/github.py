"""GitHub integration API endpoints.

This module contains endpoints for reading, writing, and listing
files in GitHub repositories.
"""

from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from dependencies import get_github_client
from github_service import GitHubConfig, GitHubService
from models import (
    GitHubBranchesReq,
    GitHubFileReadReq,
    GitHubFileWriteReq,
    GitHubListReq,
)

router = APIRouter(prefix="/github", tags=["github"])


@router.post("/file/read")
async def github_read_file(
    r: GitHubFileReadReq,
    client: httpx.AsyncClient = Depends(get_github_client),
) -> dict[str, Any]:
    """Read a file from GitHub repository.

    Args:
        r: GitHubFileReadReq with config and file path.

    Returns:
        Dict with file content, sha, and metadata.

    Raises:
        HTTPException: 404 if file not found, 500 on other errors.
    """
    try:
        service = GitHubService(r.config, client)
        result = await service.get_file(r.path)
        return result
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {r.path}",
            ) from e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GitHub API error: {e}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file: {e}",
        ) from e


@router.post("/file/write")
async def github_write_file(
    r: GitHubFileWriteReq,
    client: httpx.AsyncClient = Depends(get_github_client),
) -> dict[str, Any]:
    """Create or update a file in GitHub repository.

    Args:
        r: GitHubFileWriteReq with config, path, content, message, and optional sha.

    Returns:
        Dict with commit and file metadata.

    Raises:
        HTTPException: 409 if SHA mismatch, 500 on other errors.
    """
    try:
        service = GitHubService(r.config, client)
        result = await service.create_or_update_file(
            r.path, r.content, r.message, r.sha
        )
        return result
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 409:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="File SHA mismatch. Fetch file again before updating.",
            ) from e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GitHub API error: {e}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write file: {e}",
        ) from e


@router.post("/list")
async def github_list_directory(
    r: GitHubListReq,
    client: httpx.AsyncClient = Depends(get_github_client),
) -> dict[str, Any]:
    """List files in a GitHub repository directory.

    Args:
        r: GitHubListReq with config and directory path.

    Returns:
        Dict with list of files and directories.

    Raises:
        HTTPException: 404 if directory not found, 500 on other errors.
    """
    try:
        service = GitHubService(r.config, client)
        items = await service.list_directory(r.path)
        return {
            "items": items,
            "count": len(items),
            "path": r.path,
        }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Directory not found: {r.path}",
            ) from e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GitHub API error: {e}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list directory: {e}",
        ) from e


@router.post("/branches")
async def github_list_branches(
    r: GitHubBranchesReq,
    client: httpx.AsyncClient = Depends(get_github_client),
) -> dict[str, Any]:
    """List all branches in a GitHub repository.

    Args:
        r: GitHubBranchesReq with config.

    Returns:
        Dict with list of branches.

    Raises:
        HTTPException: 500 on API errors.
    """
    try:
        service = GitHubService(r.config, client)
        branches = await service.get_branches()
        return {
            "branches": branches,
            "count": len(branches),
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GitHub API error: {e}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list branches: {e}",
        ) from e