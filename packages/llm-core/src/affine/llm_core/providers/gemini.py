from __future__ import annotations
import json

from typing import Any, AsyncIterator

import httpx

from affine.llm_core.interfaces import LLMProvider
from affine.shared.models import TextMessage

DEFAULT_MODEL = "gemini-3.1-pro-preview"
DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MAX_OUTPUT_TOKENS = 8192
DEFAULT_TEMPERATURE = 0.7
REQUEST_TIMEOUT_SECONDS = 120.0


class GeminiProvider(LLMProvider):
    def __init__(
        self,
        api_key: str | None = None,
        model: str = DEFAULT_MODEL,
        base_url: str = DEFAULT_BASE_URL,
    ) -> None:
        if not api_key:
            raise ValueError("Gemini API key not provided.")
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient()
        return self._client

    @property
    def name(self) -> str:
        return "gemini"

    def _get_endpoint(self, action: str) -> str:
        return f"{self.base_url}/models/{self.model}:{action}"

    def _convert_messages(
        self, prompt: str, history: list[TextMessage] | None = None
    ) -> list[dict[str, Any]]:
        contents: list[dict[str, Any]] = []
        if history:
            for msg in history:
                role = "user" if msg["role"] == "user" else "model"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})
        return contents

    def _build_request_body(
        self,
        prompt: str,
        *,
        system: str | None = None,
        history: list[TextMessage] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "contents": self._convert_messages(prompt, history),
            "generationConfig": {
                "maxOutputTokens": kwargs.get("max_tokens", DEFAULT_MAX_OUTPUT_TOKENS),
                "temperature": kwargs.get("temperature", DEFAULT_TEMPERATURE),
            },
        }
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        return body

    @staticmethod
    def _extract_text(data: dict[str, Any]) -> str:
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        return "".join(part.get("text", "") for part in parts)

    async def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        history: list[TextMessage] | None = None,
        **kwargs: Any,
    ) -> str:
        url = self._get_endpoint("generateContent")
        response = await self.client.post(
            url,
            params={"key": self.api_key},
            json=self._build_request_body(
                prompt, system=system, history=history, **kwargs
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
        url = self._get_endpoint("streamGenerateContent")
        async with self.client.stream(
            "POST",
            url,
            params={"key": self.api_key, "alt": "sse"},
            json=self._build_request_body(
                prompt, system=system, history=history, **kwargs
            ),
            timeout=REQUEST_TIMEOUT_SECONDS,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str:
                        yield self._extract_text(json.loads(data_str))
