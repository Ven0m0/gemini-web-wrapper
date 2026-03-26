"""Bifrost AI gateway provider."""

from typing import Any, AsyncIterator

from affine.llm_core.interfaces import CompletionChunk, CompletionResponse, LLMProvider
from affine.llm_core.factory import register_provider
from affine.shared.schemas import Message
from affine.shared.tools import ToolCall


MODEL_CONTEXT_WINDOWS = {
    "bifrost-default": 128000,
}

MODEL_MAX_OUTPUTS = {
    "bifrost-default": 8192,
}


@register_provider("bifrost")
class BifrostProvider:
    """Bifrost AI gateway provider (OpenAI-compatible)."""

    name = "bifrost"
    default_model = "bifrost-default"
    supports_streaming = True

    def __init__(self, config: Any) -> None:
        """Initialize the Bifrost provider."""
        self._config = config
        self._client: Any | None = None

    async def completion(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[ToolCall] | None = None,
        **kwargs: Any,
    ) -> CompletionResponse:
        """Generate a full completion using Bifrost API."""
        raise NotImplementedError("Bifrost completion not yet implemented")

    async def stream(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[ToolCall] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[CompletionChunk]:
        """Generate a streaming completion using Bifrost API."""
        raise NotImplementedError("Bifrost streaming not yet implemented")

    def supports_tools(self) -> bool:
        """Bifrost supports function calling."""
        return True

    def supports_vision(self) -> bool:
        """Bifrost supports vision/multimodal input."""
        return True

    def get_system_prompt(self) -> str | None:
        """No special system prompt modifications."""
        return None

    def get_context_window(self, model: str) -> int | None:
        """Get context window for model."""
        return MODEL_CONTEXT_WINDOWS.get(model)

    def get_max_output_tokens(self, model: str) -> int | None:
        """Get max output tokens for model."""
        return MODEL_MAX_OUTPUTS.get(model)


__all__ = ["BifrostProvider"]
