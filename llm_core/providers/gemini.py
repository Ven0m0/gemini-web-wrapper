from __future__ import annotations

from collections.abc import AsyncGenerator, Sequence
from typing import Any

from google import genai

from llm_core.interfaces import LLMProvider


class GeminiProvider(LLMProvider):
    """Gemini provider using the `google.genai` SDK."""

    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash-exp"):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    async def generate(
        self,
        prompt: str,
        system: str | None = None,
        history: Sequence[dict[str, str]] | None = None,
        **kwargs: Any,
    ) -> str:
        config: dict[str, Any] = {}
        if system:
            config["system_instruction"] = system

        messages = self._build_messages(prompt, history)
        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=messages,
            config=config,
        )
        return response.text or ""

    async def stream(
        self,
        prompt: str,
        system: str | None = None,
        history: Sequence[dict[str, str]] | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[str]:
        config: dict[str, Any] = {}
        if system:
            config["system_instruction"] = system

        messages = self._build_messages(prompt, history)

        stream_obj: Any = self.client.aio.models.generate_content_stream(
            model=self.model_name,
            contents=messages,
            config=config,
        )
        if hasattr(stream_obj, "__await__"):
            stream_obj = await stream_obj

        async for chunk in stream_obj:
            text = getattr(chunk, "text", None)
            if text:
                yield text

    def _build_messages(
        self,
        prompt: str,
        history: Sequence[dict[str, str]] | None,
    ) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = []
        if history:
            for message in history:
                role = message.get("role", "user")
                if role == "assistant":
                    role = "model"

                messages.append(
                    {
                        "role": role,
                        "parts": [{"text": message.get("content", "")}],
                    }
                )

        messages.append({"role": "user", "parts": [{"text": prompt}]})
        return messages
