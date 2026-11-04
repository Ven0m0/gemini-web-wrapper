from __future__ import annotations

from collections.abc import AsyncIterator
from types import TracebackType
from typing import Any, Self

import httpx
import orjson

from affine.llm_core.interfaces import LLMProvider, ModelInfo
from affine.shared.models import TextMessage

DEFAULT_MAX_TOKENS = 4096
DEFAULT_TEMPERATURE = 0.7
REQUEST_TIMEOUT_SECONDS = 120.0
NON_CHAT_MODEL_PREFIXES = (
    "text-embedding",
    "embedding",
    "tts-",
    "whisper",
    "dall-e",
    "omni-moderation",
    "text-moderation",
)


def _is_chat_model(item: dict[str, Any]) -> bool:
    if item["id"].startswith(NON_CHAT_MODEL_PREFIXES):
        return False
    # Copilot tags each model with capabilities.type ("chat", "embeddings", ...).
    capabilities = item.get("capabilities")
    if isinstance(capabilities, dict) and "type" in capabilities:
        return capabilities["type"] == "chat"
    return True


class OpenAICompatibleProvider(LLMProvider):
    def __init__(
        self,
        provider_name: str,
        model: str,
        base_url: str | None = None,
        api_key: str | None = None,
    ) -> None:
        if not provider_name:
            raise ValueError("Provider name not provided.")
        if not model:
            raise ValueError("Model not provided.")
        if not base_url:
            raise ValueError("Base URL not provided.")

        self.provider_name = provider_name
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.headers = {"content-type": "application/json"}
        if api_key:
            self.headers["authorization"] = f"Bearer {api_key}"
        self._client = httpx.AsyncClient(http2=True)

    @property
    def name(self) -> str:
        return self.provider_name

    def _build_messages(
        self,
        prompt: str,
        *,
        system: str | None = None,
        history: list[TextMessage] | None = None,
    ) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        if history:
            messages.extend(
                {"role": message["role"], "content": message["content"]}
                for message in history
            )
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
            "messages": self._build_messages(prompt, system=system, history=history),
            "stream": stream,
            "max_tokens": kwargs.get("max_tokens", DEFAULT_MAX_TOKENS),
        }
        if kwargs.get("temperature") is not None:
            body["temperature"] = kwargs["temperature"]
        else:
            body["temperature"] = DEFAULT_TEMPERATURE
        return body

    @staticmethod
    def _extract_message_text(data: dict[str, Any]) -> str:
        choices = data.get("choices", [])
        if not choices:
            return ""
        content = choices[0].get("message", {}).get("content", "")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and isinstance(part.get("text"), str)
            )
        return ""

    @staticmethod
    def _extract_delta_text(data: dict[str, Any]) -> str:
        choices = data.get("choices", [])
        if not choices:
            return ""
        content = choices[0].get("delta", {}).get("content", "")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and isinstance(part.get("text"), str)
            )
        return ""

    async def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        history: list[TextMessage] | None = None,
        **kwargs: Any,
    ) -> str:
        response = await self._client.post(
            f"{self.base_url}/chat/completions",
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
        return self._extract_message_text(response.json())

    async def stream(
        self,
        prompt: str,
        *,
        system: str | None = None,
        history: list[TextMessage] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        async with self._client.stream(
            "POST",
            f"{self.base_url}/chat/completions",
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
                if not line.startswith("data: "):
                    continue
                data_str = line[6:].strip()
                if not data_str or data_str == "[DONE]":
                    continue
                try:
                    data = orjson.loads(data_str)
                except orjson.JSONDecodeError as exc:
                    raise ValueError(
                        f"Malformed streaming response from"
                        f" {self.provider_name}: {data_str!r}"
                    ) from exc
                yield self._extract_delta_text(data)

    async def list_models(self) -> list[ModelInfo]:
        response = await self._client.get(
            f"{self.base_url}/models",
            headers=self.headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return [
            {"id": item["id"], "name": item.get("name") or item["id"]}
            for item in response.json().get("data", [])
            if isinstance(item.get("id"), str) and _is_chat_model(item)
        ]

    async def aclose(self) -> None:
        if not self._client.is_closed:
            await self._client.aclose()

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        await self.aclose()
