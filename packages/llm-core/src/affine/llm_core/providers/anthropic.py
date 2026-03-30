from __future__ import annotations
import os
import json
import httpx
from typing import Any, AsyncIterator, List, Optional
from affine.llm_core.interfaces import LLMProvider


class AnthropicProvider(LLMProvider):
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "claude-3-5-sonnet-20241022",
        base_url: str = "https://api.anthropic.com/v1",
    ):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("Anthropic API key not provided or configured.")
        self.model = model
        self.base_url = base_url
        self.headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

    @property
    def name(self) -> str:
        return "anthropic"

    def _convert_messages(
        self, prompt: str, history: Optional[List[dict[str, str]]] = None
    ) -> List[dict]:
        messages = []
        if history:
            for msg in history:
                messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": prompt})
        return messages

    async def generate(
        self,
        prompt: str,
        *,
        system: Optional[str] = None,
        history: Optional[List[dict[str, str]]] = None,
        **kwargs: Any,
    ) -> str:
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}/messages"
            body = {
                "model": self.model,
                "max_tokens": kwargs.get("max_tokens", 4096),
                "messages": self._convert_messages(prompt, history),
                "stream": False,
            }
            if system:
                body["system"] = system

            response = await client.post(
                url,
                headers=self.headers,
                json=body,
                timeout=120.0,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("content", [{}])[0].get("text", "")

    async def stream(
        self,
        prompt: str,
        *,
        system: Optional[str] = None,
        history: Optional[List[dict[str, str]]] = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}/messages"
            body = {
                "model": self.model,
                "max_tokens": kwargs.get("max_tokens", 4096),
                "messages": self._convert_messages(prompt, history),
                "stream": True,
            }
            if system:
                body["system"] = system

            async with client.stream(
                "POST",
                url,
                headers=self.headers,
                json=body,
                timeout=120.0,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = json.loads(line[6:])
                        if data.get("type") == "content_block_delta":
                            delta = data.get("delta", {})
                            if delta.get("type") == "text_delta":
                                yield delta.get("text", "")
