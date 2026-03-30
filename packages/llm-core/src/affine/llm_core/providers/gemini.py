from __future__ import annotations
import os
import json
import httpx
from typing import Any, AsyncIterator, List, Optional
from affine.llm_core.interfaces import LLMProvider


class GeminiProvider(LLMProvider):
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-2.0-flash-exp",
        base_url: str = "https://generativelanguage.googleapis.com/v1beta",
    ):
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        self.model = model
        self.base_url = base_url

    @property
    def name(self) -> str:
        return "gemini"

    def _get_endpoint(self, action: str) -> str:
        return f"{self.base_url}/models/{self.model}:{action}"

    def _convert_messages(
        self, prompt: str, history: Optional[List[dict[str, str]]] = None
    ) -> List[dict]:
        contents = []
        if history:
            for msg in history:
                role = "user" if msg["role"] == "user" else "model"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})
        return contents

    async def generate(
        self,
        prompt: str,
        *,
        system: Optional[str] = None,
        history: Optional[List[dict[str, str]]] = None,
        **kwargs: Any,
    ) -> str:
        async with httpx.AsyncClient() as client:
            url = self._get_endpoint("generateContent")
            body = {
                "contents": self._convert_messages(prompt, history),
                "generationConfig": {
                    "maxOutputTokens": kwargs.get("max_tokens", 8192),
                    "temperature": kwargs.get("temperature", 0.7),
                },
            }
            if system:
                body["systemInstruction"] = {"parts": [{"text": system}]}

            response = await client.post(
                url,
                params={"key": self.api_key},
                json=body,
                timeout=120.0,
            )
            response.raise_for_status()
            data = response.json()

            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            return "".join(part.get("text", "") for part in parts)

    async def stream(
        self,
        prompt: str,
        *,
        system: Optional[str] = None,
        history: Optional[List[dict[str, str]]] = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        async with httpx.AsyncClient() as client:
            url = self._get_endpoint("streamGenerateContent")
            body = {
                "contents": self._convert_messages(prompt, history),
                "generationConfig": {
                    "maxOutputTokens": kwargs.get("max_tokens", 8192),
                    "temperature": kwargs.get("temperature", 0.7),
                },
            }
            if system:
                body["systemInstruction"] = {"parts": [{"text": system}]}

            async with client.stream(
                "POST",
                url,
                params={"key": self.api_key, "alt": "sse"},
                json=body,
                timeout=120.0,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str:
                            data = json.loads(data_str)
                            parts = (
                                next(iter(data.get("candidates", [])), {})
                                .get("content", {})
                                .get("parts", [])
                            )
                            yield "".join(part.get("text", "") for part in parts)
