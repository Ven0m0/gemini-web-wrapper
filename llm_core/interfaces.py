from typing import Protocol, runtime_checkable, Any
from collections.abc import AsyncGenerator, Sequence
from dataclasses import dataclass

@dataclass
class ChatMessage:
    role: str
    content: str

@runtime_checkable
class LLMProvider(Protocol):
    """Protocol for Universal LLM Providers."""

    async def generate(
        self,
        prompt: str,
        system: str | None = None,
        history: Sequence[dict[str, str]] | None = None,
        **kwargs: Any
    ) -> str:
        """Generate a complete text response."""
        ...

    def stream(
        self,
        prompt: str,
        system: str | None = None,
        history: Sequence[dict[str, str]] | None = None,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """Stream the text response chunk by chunk."""
        ...
