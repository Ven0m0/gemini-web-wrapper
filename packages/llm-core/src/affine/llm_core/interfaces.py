from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator

from affine.shared.models import TextMessage


class LLMProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        ...

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        history: list[TextMessage] | None = None,
        **kwargs: Any,
    ) -> str:
        ...

    @abstractmethod
    def stream(
        self,
        prompt: str,
        *,
        system: str | None = None,
        history: list[TextMessage] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        ...

    async def aclose(self) -> None:
        ...
