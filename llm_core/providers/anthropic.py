import os
from collections.abc import AsyncGenerator, Sequence
from typing import Any

from anthropic import AsyncAnthropic
from llm_core.interfaces import LLMProvider

class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider."""

    def __init__(self, api_key: str | None = None, model: str = "claude-3-5-sonnet-20241022"):
        self.client = AsyncAnthropic(api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"))
        self.model = model

    async def generate(
        self,
        prompt: str,
        system: str | None = None,
        history: Sequence[dict[str, str]] | None = None,
        **kwargs: Any
    ) -> str:
        messages = self._build_messages(prompt, history)

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=kwargs.get("max_tokens", 4096),
            system=system or "",
            messages=messages,
        )
        # response.content is a list of blocks, usually text.
        text_blocks = [block.text for block in response.content if block.type == 'text']
        return "".join(text_blocks)

    async def stream(
        self,
        prompt: str,
        system: str | None = None,
        history: Sequence[dict[str, str]] | None = None,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        messages = self._build_messages(prompt, history)

        async with self.client.messages.stream(
            model=self.model,
            max_tokens=kwargs.get("max_tokens", 4096),
            system=system or "",
            messages=messages,
        ) as stream:
             async for text in stream.text_stream:
                 yield text

    def _build_messages(self, prompt: str, history: Sequence[dict[str, str]] | None) -> list[dict[str, any]]:
        msgs = []
        if history:
            for h in history:
                # Anthropic message format: role (user/assistant) and content
                # Mapping model -> assistant if necessary, though 'model' is common in some schemas
                role = h.get("role", "user")
                if role == "model":
                    role = "assistant"
                msgs.append({"role": role, "content": h.get("content", "")})

        msgs.append({"role": "user", "content": prompt})
        return msgs
