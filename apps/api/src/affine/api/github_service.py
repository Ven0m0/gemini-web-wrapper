"""GitHub API integration service for Chat_github functionality.

Provides file operations (read, write, commit) using GitHub REST API.
"""

import base64
import logging
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class GitHubConfig(BaseModel):
    """GitHub configuration model.

    Attributes:
        token: GitHub Personal Access Token.
        owner: Repository owner (username or org).
        repo: Repository name.
        branch: Git branch name (default: main).
    """

    token: str = Field(..., min_length=1)
    owner: str = Field(..., min_length=1)
    repo: str = Field(..., min_length=1)
    branch: str = "main"


class GitHubService:
    """Service for interacting with GitHub REST API.

    Handles file operations including reading, writing, listing, and committing.
    """

    def __init__(
        self,
        config: GitHubConfig,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        """Initialize GitHub service with configuration.

        Args:
            config: GitHubConfig with token, owner, repo, and branch.
            client: Optional shared httpx.AsyncClient.
        """
        self.config = config
        self.client = client
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"Bearer {config.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    @asynccontextmanager
    async def _get_client(self):
        """Yields the shared client or creates a new ephemeral one."""
        if self.client:
            yield self.client
        else:
            async with httpx.AsyncClient() as client:
                yield client

    async def get_file(self, path: str) -> dict[str, Any]:
        """Get file content from GitHub.

        Args:
            path: File path in repository.

        Returns:
            Dict with file content, sha, and metadata.

        Raises:
            httpx.HTTPStatusError: If file not found or API error.
        """
        url = f"{self.base_url}/repos/{self.config.owner}/{self.config.repo}/contents/{path}"
        params = {"ref": self.config.branch}

        async with self._get_client() as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()

            # Decode content if it's base64 encoded
            if "content" in data and data.get("encoding") == "base64":
                content = base64.b64decode(data["content"]).decode("utf-8")
                data["decoded_content"] = content

            return data

    async def list_directory(self, path: str = "") -> list[dict[str, Any]]:
        """List files in a directory.

        Args:
            path: Directory path in repository (empty for root).

        Returns:
            List of file/directory metadata dicts.

        Raises:
            httpx.HTTPStatusError: If directory not found or API error.
        """
        url = f"{self.base_url}/repos/{self.config.owner}/{self.config.repo}/contents/{path}"
        params = {"ref": self.config.branch}

        async with self._get_client() as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()

    async def create_or_update_file(
        self,
        path: str,
        content: str,
        message: str,
        sha: str | None = None,
    ) -> dict[str, Any]:
        """Create or update a file in the repository.

        Args:
            path: File path in repository.
            content: File content to write.
            message: Commit message.
            sha: File SHA for updates (required for existing files).

        Returns:
            Dict with commit and file metadata.

        Raises:
            httpx.HTTPStatusError: If commit fails or API error.
        """
        url = f"{self.base_url}/repos/{self.config.owner}/{self.config.repo}/contents/{path}"

        # Encode content to base64
        encoded_content = base64.b64encode(content.encode("utf-8")).decode("utf-8")

        data: dict[str, Any] = {
            "message": message,
            "content": encoded_content,
            "branch": self.config.branch,
        }

        # Include SHA for updates
        if sha:
            data["sha"] = sha

        async with self._get_client() as client:
            response = await client.put(url, headers=self.headers, json=data)
            response.raise_for_status()
            return response.json()

    async def delete_file(self, path: str, message: str, sha: str) -> dict[str, Any]:
        """Delete a file from the repository.

        Args:
            path: File path in repository.
            message: Commit message.
            sha: File SHA (required for deletion).

        Returns:
            Dict with commit metadata.

        Raises:
            httpx.HTTPStatusError: If deletion fails or API error.
        """
        url = f"{self.base_url}/repos/{self.config.owner}/{self.config.repo}/contents/{path}"

        data = {
            "message": message,
            "sha": sha,
            "branch": self.config.branch,
        }

        async with self._get_client() as client:
            response = await client.delete(url, headers=self.headers, json=data)
            response.raise_for_status()
            return response.json()

    async def get_branches(self) -> list[dict[str, Any]]:
        """List all branches in the repository.

        Returns:
            List of branch metadata dicts.

        Raises:
            httpx.HTTPStatusError: If API error.
        """
        url = f"{self.base_url}/repos/{self.config.owner}/{self.config.repo}/branches"

        async with self._get_client() as client:
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()

    async def get_tldr_summary(self, path: str = "") -> str:
        """Get a token-efficient summary of the repository or a path using llm-tldr.

        Args:
            path: Optional subdirectory path.

        Returns:
            Summary string generated by tldr.
        """
        # This is a simplified version that runs tldr on a local clone or
        # fetched files. For this implementation, we'll assume a local context
        # or use the tldr command directly if available.
        try:
            # Normalize and validate the requested path to stay within the project root.
            base_dir = Path(".").resolve()
            if not path:
                safe_path = str(base_dir)
            else:
                requested = (base_dir / path).resolve()
                try:
                    # Ensure the requested path is within the base directory.
                    requested.relative_to(base_dir)
                except ValueError as ve:
                    logger.warning(
                        "Rejected unsafe path for tldr summary: %s (base: %s)",
                        path,
                        base_dir,
                    )
                    raise RuntimeError("Invalid path for tldr summary") from ve
                safe_path = str(requested)

            # We use subprocess to call the tldr CLI
            # In a real environment, we'd need to have the files locally
            # For now, we'll provide the command output if it was run on the current repo
            cmd = ["tldr", "structure", safe_path]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=30,
            )
            return result.stdout
        except (subprocess.CalledProcessError, FileNotFoundError, RuntimeError) as e:
            # Log detailed error server-side and raise a generic exception
            logger.exception("Error generating tldr summary using command %s", cmd)
            raise RuntimeError("Failed to generate tldr summary") from e

    async def get_repository_info(self) -> dict[str, Any]:
        """Get repository information.

        Returns:
            Dict with repository metadata.

        Raises:
            httpx.HTTPStatusError: If API error.
        """
        url = f"{self.base_url}/repos/{self.config.owner}/{self.config.repo}"

        async with self._get_client() as client:
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
