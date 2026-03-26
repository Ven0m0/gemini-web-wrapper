"""Google Gemini provider.

Supports both google-genai (API key) and gemini-webapi (cookie auth) backends.
"""

from typing import Any, AsyncIterator

from pydantic import Field

from affine.llm_core.interfaces import CompletionChunk, CompletionResponse, LLMProvider
from affine.llm_core.factory import register_provider
from affine.shared.schemas import Message
from affine.shared.tools import ToolCall


MODEL_CONTEXT_WINDOWS = {
    "gemini-2.5-flash": 128000,
    "gemini-2.5-pro": 128000,
    "gemini-3.0-flash": 128000,
    "gemini-3.0-pro": 128000,
}

MODEL_MAX_OUTPUTS = {
    "gemini-2.5-flash": 8192,
    "gemini-2.5-pro": 8192,
    "gemini-3.0-flash": 8192,
    "gemini-3.0-pro": 8192,
}


@register_provider("gemini")
class GoogleProvider:
    """Google Gemini LLM provider.

    Supports two backends:
    - google-genai: API key authentication
    - gemini-webapi: Browser cookie authentication (no API key required)
    """

    name = "google"
    default_model = "gemini-2.5-flash"
    supports_streaming = True

    def __init__(self, config: Any) -> None:
        """Initialize the Gemini provider.

        Args:
            config: Provider configuration with credentials.
        """
        self._config = config
        self._client: Any | None = None

    def _get_backend(self) -> str:
        """Determine which backend to use based on config."""
        if hasattr(self._config, "credentials"):
            return "webapi"
        return "genai"

    async def completion(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[ToolCall] | None = None,
        **kwargs: Any,
    ) -> CompletionResponse:
        """Generate a full completion using Gemini API."""
        raise NotImplementedError("Use stream() for Gemini - Gemini is streaming-only")

    async def stream(
        self,
        messages: list[Message],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[ToolCall] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[CompletionChunk]:
        """Generate a streaming completion using Gemini API."""
        raise NotImplementedError("Gemini streaming not yet implemented in shared package")

    def supports_tools(self) -> bool:
        """Gemini supports function calling."""
        return True

    def supports_vision(self) -> bool:
        """Gemini supports vision/multimodal input."""
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


__all__ = ["GoogleProvider"]
