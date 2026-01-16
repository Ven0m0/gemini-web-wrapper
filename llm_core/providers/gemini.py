from collections.abc import AsyncGenerator, Sequence
from typing import Any
import asyncio
from google import genai
from llm_core.interfaces import LLMProvider

class GeminiProvider(LLMProvider):
    """Gemini provider using google.genai SDK directly."""

    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash-exp"):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    async def generate(
        self,
        prompt: str,
        system: str | None = None,
        history: Sequence[dict[str, str]] | None = None,
        **kwargs: Any
    ) -> str:

        # Build configuration for generation
        config = {}
        if system:
            config['system_instruction'] = system

        messages = self._build_messages(prompt, history)

        # google.genai supports async generation
        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=messages,
            config=config
        )
        return response.text

    async def stream(
        self,
        prompt: str,
        system: str | None = None,
        history: Sequence[dict[str, str]] | None = None,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:

        config = {}
        if system:
            config['system_instruction'] = system

        messages = self._build_messages(prompt, history)

        async for chunk in await self.client.aio.models.generate_content_stream(
            model=self.model_name,
            contents=messages,
            config=config
        ):
            if chunk.text:
                yield chunk.text

    def _build_messages(
        self,
        prompt: str,
        history: Sequence[dict[str, str]] | None
    ) -> list[dict[str, str]]:
        msgs = []
        if history:
            for h in history:
                role = h.get("role", "user")
                if role == "assistant": # Map standard assistant role to model
                    role = "model"
                msgs.append({"role": role, "parts": [{"text": h.get("content", "")}]})

        msgs.append({"role": "user", "parts": [{"text": prompt}]})
        return msgs
