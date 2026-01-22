from __future__ import annotations

from collections.abc import AsyncGenerator, Sequence
from typing import Any

from llm_core.interfaces import LLMProvider


class CopilotProvider(LLMProvider):
    """GitHub Copilot provider.

    The Copilot SDK typically targets agent/extension-style integrations.
    This implementation is a minimal placeholder so the provider interface stays
    consistent across the app.
    """

    def __init__(self, **_kwargs: Any) -> None:
        self._message = "GitHub Copilot provider is not yet integrated."

    async def generate(
        self,
        _prompt: str,
        system: str | None = None,
        history: Sequence[dict[str, str]] | None = None,
        **_kwargs: Any,
    ) -> str:
        _ = (system, history)
        return self._message

    async def stream(
        self,
        _prompt: str,
        system: str | None = None,
        history: Sequence[dict[str, str]] | None = None,
        **_kwargs: Any,
    ) -> AsyncGenerator[str]:
        _ = (system, history)
        yield self._message
