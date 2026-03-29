from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, List, Optional
from affine.shared.models import Message, Usage

class LLMProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        *,
        system: Optional[str] = None,
        history: Optional[List[dict[str, str]]] = None,
        **kwargs: Any,
    ) -> str:
        pass

    @abstractmethod
    def stream(
        self,
        prompt: str,
        *,
        system: Optional[str] = None,
        history: Optional[List[dict[str, str]]] = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        pass
