"""Pydantic models for request/response validation.

This module contains all request and response models used across
the API endpoints for type safety and validation.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field


# ----- Request Models -----


class ChatMessage(BaseModel):
    """A single message in a chat conversation."""

    role: Literal["system", "user", "model"]
    content: str = Field(..., min_length=1)


class ChatReq(BaseModel):
    """Request model for chat endpoint."""

    prompt: str = Field(..., min_length=1, max_length=50000)
    system: str | None = Field(default=None, max_length=10000)


class ChatbotReq(BaseModel):
    """Request model for chatbot endpoint with history."""

    message: str = Field(..., min_length=1, max_length=50000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=50)
    system: str | None = Field(default=None, max_length=10000)
    user_id: str | None = Field(default=None)
    session_id: str | None = Field(default=None)


class CodeReq(BaseModel):
    """Request model for code assistance endpoint."""

    code: str = Field(..., min_length=1, max_length=100000)
    instruction: str = Field(..., min_length=1, max_length=10000)


class SessionQueryReq(BaseModel):
    """Request model for session query endpoint."""

    user_id: str = Field(..., min_length=1)


class ProfileCreateReq(BaseModel):
    """Request model for creating a profile from browser cookies."""

    name: str = Field(..., min_length=1)
    browser: str = Field(default="chrome")


class ProfileSwitchReq(BaseModel):
    """Request model for switching to a profile."""

    name: str = Field(..., min_length=1)


class GeminiChatReq(BaseModel):
    """Request model for gemini-webapi chat endpoint."""

    message: str = Field(..., min_length=1, max_length=50000)
    conversation_id: str | None = Field(default=None)
    profile: str | None = Field(default=None)


# Import GitHubConfig from github_service to avoid circular imports
from github_service import GitHubConfig


class GitHubFileReadReq(BaseModel):
    """Request model for reading a file from GitHub."""

    config: GitHubConfig
    path: str = Field(..., min_length=1)


class GitHubFileWriteReq(BaseModel):
    """Request model for writing/updating a file to GitHub."""

    config: GitHubConfig
    path: str = Field(..., min_length=1)
    content: str
    message: str = Field(..., min_length=1)
    sha: str | None = None


class GitHubListReq(BaseModel):
    """Request model for listing directory contents."""

    config: GitHubConfig
    path: str = ""


class GitHubBranchesReq(BaseModel):
    """Request model for listing branches."""

    config: GitHubConfig


class DocumentUploadReq(BaseModel):
    """Request model for document upload."""

    filename: str
    content: str
    collection_name: str = "default"


class Tool(BaseModel):
    """Request model for tool creation."""

    id: str
    name: str
    description: str
    json_schema: dict
    scope: str = "chat"


class ChatHistoryItem(BaseModel):
    """Request model for chat history item."""

    id: str
    user_id: str
    session_id: str | None
    chat: dict
    timestamp: int


# ----- Response Models -----


class GenResponse(BaseModel):
    """Response model for generation endpoints."""

    text: str
