from __future__ import annotations

import os
from collections.abc import AsyncGenerator, Sequence
from typing import Any

from openai import AsyncOpenAI

from llm_core.interfaces import LLMProvider


class BifrostProvider(LLMProvider):
    """Bifrost AI Gateway provider.

    Bifrost is a high-performance AI gateway that provides unified access
    to multiple LLM providers through an OpenAI-compatible API.
    """

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str = "gpt-4o-mini",
    ):
        """Initialize Bifrost provider.

        Args:
            base_url: Bifrost gateway URL (default: http://localhost:8080/v1)
            api_key: Optional API key for Bifrost authentication
            model: Model identifier to use through Bifrost
        """
        self.client = AsyncOpenAI(
            base_url=base_url
            or os.environ.get("BIFROST_URL", "http://localhost:8080/v1"),
            api_key=api_key or os.environ.get("BIFROST_API_KEY", "sk-bifrost-default"),
        )
        self.model = model

    async def generate(
        self,
        prompt: str,
        system: str | None = None,
        history: Sequence[dict[str, str]] | None = None,
        **kwargs: Any,
    ) -> str:
        """Generate a complete text response."""
        messages = self._build_messages(prompt, system, history)
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=kwargs.get("max_tokens", 4096),
            temperature=kwargs.get("temperature", 1.0),
            **{
                k: v
                for k, v in kwargs.items()
                if k not in ["max_tokens", "temperature"]
            },
        )

        if response.choices and response.choices[0].message.content:
            return response.choices[0].message.content
        return ""

    async def stream(
        self,
        prompt: str,
        system: str | None = None,
        history: Sequence[dict[str, str]] | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[str]:
        """Stream the text response chunk by chunk."""
        messages = self._build_messages(prompt, system, history)

        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=kwargs.get("max_tokens", 4096),
            temperature=kwargs.get("temperature", 1.0),
            stream=True,
            **{
                k: v
                for k, v in kwargs.items()
                if k not in ["max_tokens", "temperature", "stream"]
            },
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    def _build_messages(
        self,
        prompt: str,
        system: str | None,
        history: Sequence[dict[str, str]] | None,
    ) -> list[dict[str, Any]]:
        """Build OpenAI-compatible message list."""
        messages: list[dict[str, Any]] = []

        if system:
            messages.append({"role": "system", "content": system})

        if history:
            for message in history:
                role = message.get("role", "user")
                # Normalize role names
                if role == "model":
                    role = "assistant"
                messages.append({"role": role, "content": message.get("content", "")})

        messages.append({"role": "user", "content": prompt})
        return messages
