"""LLM provider protocol and types.

Defines the interface all LLM providers must implement.
"""

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Protocol, TypeVar, runtime_checkable

from pydantic import BaseModel, Field

from affine.shared.schemas import Message, Role
from affine.shared.provider_config import ProviderConfig
from affine.shared.tools import ToolCall


class CompletionChunk(BaseModel):
    """A single chunk in a streaming completion response."""

    delta: str = Field(description="Text delta for this chunk")
    is_final: bool = Field(default=False, description="Whether this is the final chunk")
    finish_reason: str | None = Field(default=None, description="Finish reason if is_final=True")
    usage: dict[str, int] | None = Field(default=None, description="Usage stats if is_final=True")


class CompletionResponse(BaseModel):
    """A complete non-streaming completion response."""

    content: str = Field(description="The complete response content")
    model: str = Field(description="Model that generated the response")
    finish_reason: str = Field(description="Reason generation stopped")
    usage: dict[str, int] = Field(description="Token usage statistics")
    provider: str = Field(description="Provider that generated the response")


class LLMProviderType(str, Protocol):
    """Type marker for LLM provider kind."""

    pass


@runtime_checkable
class LLMProvider(Protocol):
    """Protocol defining the interface for all LLM providers.

    Providers must implement:
    - name: Provider identifier
    - default_model: Default model identifier
    - supports_streaming: Whether provider supports streaming
    - completion: Full completion (non-streaming)
    - stream: Streaming completion
    - tools: Tool/schema support
    - vision: Image/vision support
    """

    name: str
    default_model: str
    supports_streaming: bool

    async def completion(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[ToolCall] | None = None,
        **kwargs: Any,
    ) -> CompletionResponse:
        """Generate a full completion (non-streaming)."""
        ...

    async def stream(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[ToolCall] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[CompletionChunk]:
        """Generate a streaming completion."""
        ...

    def supports_tools(self) -> bool:
        """Check if provider supports tool calling."""
        ...

    def supports_vision(self) -> bool:
        """Check if provider supports vision/multimodal input."""
        ...

    def get_system_prompt(self) -> str | None:
        """Get provider-specific system prompt modifications."""
        ...

    def get_context_window(self, model: str) -> int | None:
        """Get context window size for model, or None if unknown."""
        ...

    def get_max_output_tokens(self, model: str) -> int | None:
        """Get max output tokens for model, or None if unknown."""
        ...
