from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any, TypedDict

from affine.shared.models import TextMessage


class ModelInfo(TypedDict):
    id: str
    name: str


class LLMProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        history: list[TextMessage] | None = None,
        **kwargs: Any,
    ) -> str: ...

    @abstractmethod
    def stream(
        self,
        prompt: str,
        *,
        system: str | None = None,
        history: list[TextMessage] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]: ...

    @abstractmethod
    async def list_models(self) -> list[ModelInfo]: ...

    async def aclose(self) -> None: ...
