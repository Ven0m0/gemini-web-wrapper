from __future__ import annotations
import json

from typing import Any, AsyncIterator

import httpx

from affine.llm_core.interfaces import LLMProvider
from affine.shared.models import TextMessage

DEFAULT_MODEL = "claude-sonnet-4-6"
DEFAULT_BASE_URL = "https://api.anthropic.com/v1"
DEFAULT_MAX_TOKENS = 4096
REQUEST_TIMEOUT_SECONDS = 120.0


class AnthropicProvider(LLMProvider):
    def __init__(
        self,
        api_key: str | None = None,
        model: str = DEFAULT_MODEL,
        base_url: str = DEFAULT_BASE_URL,
    ) -> None:
        if not api_key:
            raise ValueError("Anthropic API key not provided.")
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        self._client = httpx.AsyncClient()

    @property
    def name(self) -> str:
        return "anthropic"

    def _convert_messages(
        self, prompt: str, history: list[TextMessage] | None = None
    ) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = []
        if history:
            for msg in history:
                messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": prompt})
        return messages

    def _build_request_body(
        self,
        prompt: str,
        *,
        system: str | None = None,
        history: list[TextMessage] | None = None,
        stream: bool,
        **kwargs: Any,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": self.model,
            "max_tokens": kwargs.get("max_tokens", DEFAULT_MAX_TOKENS),
            "messages": self._convert_messages(prompt, history),
            "stream": stream,
        }
        if system:
            body["system"] = system
        return body

    @staticmethod
    def _extract_text(data: dict[str, Any]) -> str:
        content = data.get("content", [])
        if not content:
            return ""
        return content[0].get("text", "")

    async def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        history: list[TextMessage] | None = None,
        **kwargs: Any,
    ) -> str:
        url = f"{self.base_url}/messages"
        response = await self._client.post(
            url,
            headers=self.headers,
            json=self._build_request_body(
                prompt,
                system=system,
                history=history,
                stream=False,
                **kwargs,
            ),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return self._extract_text(response.json())

    async def stream(
        self,
        prompt: str,
        *,
        system: str | None = None,
        history: list[TextMessage] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        url = f"{self.base_url}/messages"
        async with self._client.stream(
            "POST",
            url,
            headers=self.headers,
            json=self._build_request_body(
                prompt,
                system=system,
                history=history,
                stream=True,
                **kwargs,
            ),
            timeout=REQUEST_TIMEOUT_SECONDS,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if not data_str:
                        continue
                    data = json.loads(data_str)
                    if data.get("type") == "content_block_delta":
                        delta = data.get("delta", {})
                        if delta.get("type") == "text_delta":
                            yield delta.get("text", "")

    async def aclose(self) -> None:
        await self._client.aclose()
