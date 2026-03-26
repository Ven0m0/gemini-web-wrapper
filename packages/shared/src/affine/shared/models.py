"""Request/response base wrappers for OpenAI-compatible API."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

from affine.shared.schemas import ContentPart, Message, ProviderType
from affine.shared.tools import ToolCall, ToolDefinition


class ChatRequestBase(BaseModel):
    """Base chat request properties shared across providers."""

    messages: list[Message]
    model: str | None = None
    provider: ProviderType | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    top_p: float | None = None
    frequency_penalty: float | None = None
    presence_penalty: float | None = None
    stop: str | list[str] | None = None
    stream: bool = False
    tools: list[ToolDefinition] | None = None
    tool_choice: str | None = None
    user: str | None = None


class ChatResponseChoice(BaseModel):
    """A single completion choice in a chat response."""

    index: int
    message: Message
    finish_reason: str | None = None


class ChatResponseUsage(BaseModel):
    """Token usage statistics for a chat completion."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatResponseBase(BaseModel):
    """Base chat response properties shared across providers."""

    id: str
    object: str = "chat.completion"
    created: int = Field(default_factory=lambda: int(datetime.utcnow().timestamp()))
    model: str
    provider: ProviderType
    choices: list[ChatResponseChoice] = Field(default_factory=list)
    usage: ChatResponseUsage = Field(default_factory=ChatResponseUsage)


class StreamChunkChoice(BaseModel):
    """A delta choice in a streaming response."""

    index: int
    delta: dict[str, Any]
    finish_reason: str | None = None


class StreamChunk(BaseModel):
    """A streaming response chunk."""

    id: str
    object: str = "chat.completion.chunk"
    created: int = Field(default_factory=lambda: int(datetime.utcnow().timestamp()))
    model: str
    provider: ProviderType
    choices: list[StreamChunkChoice] = Field(default_factory=list)


# Type variable for generic request/response
T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """Generic API response wrapper."""

    data: T
    error: str | None = None


class ErrorResponse(BaseModel):
    """Standard error response."""

    error: str
    message: str
    code: str | None = None


__all__ = [
    "ChatRequestBase",
    "ChatResponseChoice",
    "ChatResponseUsage",
    "ChatResponseBase",
    "StreamChunkChoice",
    "StreamChunk",
    "APIResponse",
    "ErrorResponse",
]
