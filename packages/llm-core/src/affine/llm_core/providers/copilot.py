"""GitHub Copilot provider."""

from typing import Any, AsyncIterator

from affine.llm_core.interfaces import CompletionChunk, CompletionResponse, LLMProvider
from affine.llm_core.factory import register_provider
from affine.shared.schemas import Message
from affine.shared.tools import ToolCall


MODEL_CONTEXT_WINDOWS = {
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-4.1-mini": 128000,
}

MODEL_MAX_OUTPUTS = {
    "gpt-4o": 16384,
    "gpt-4o-mini": 16384,
    "gpt-4.1-mini": 16384,
}


@register_provider("copilot")
class CopilotProvider:
    """GitHub Copilot LLM provider."""

    name = "copilot"
    default_model = "gpt-4o-mini"
    supports_streaming = True

    def __init__(self, config: Any) -> None:
        """Initialize the Copilot provider."""
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
        """Generate a full completion using Copilot API."""
        raise NotImplementedError("Copilot completion not yet implemented")

    async def stream(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[ToolCall] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[CompletionChunk]:
        """Generate a streaming completion using Copilot API."""
        raise NotImplementedError("Copilot streaming not yet implemented")

    def supports_tools(self) -> bool:
        """Copilot supports function calling."""
        return True

    def supports_vision(self) -> bool:
        """Copilot supports vision/multimodal input."""
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


__all__ = ["CopilotProvider"]
