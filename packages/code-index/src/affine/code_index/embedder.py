"""Embedding abstraction for code indexing."""

from __future__ import annotations

from typing import Protocol

import httpx
import numpy as np


class Embedder(Protocol):
    """Protocol for text embedding providers."""

    @property
    def dimension(self) -> int:
        """Return embedding dimension."""
        ...

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed texts, return L2-normalized vectors."""
        ...


def normalize_l2(vectors: np.ndarray) -> np.ndarray:
    """L2 normalize vectors along last axis."""
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    return vectors / norms


class OpenAIEmbedder:
    """OpenAI-compatible embedding provider."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "text-embedding-3-small",
        base_url: str | None = None,
        batch_size: int = 100,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url or "https://api.openai.com/v1"
        self.batch_size = batch_size
        self._dimension = 1536  # text-embedding-3-small
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(60.0),
        )

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed texts in batches, return L2-normalized vectors."""
        all_vectors: list[list[float]] = []

        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            vectors = await self._embed_batch(batch)
            all_vectors.extend(vectors)

        return all_vectors

    async def _embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed a single batch."""
        response = await self._client.post(
            "/embeddings",
            json={
                "model": self.model,
                "input": texts,
                "encoding_format": "float",
            },
        )
        response.raise_for_status()
        data = response.json()

        embeddings = [item["embedding"] for item in data["data"]]
        embeddings.sort(key=lambda x: data["data"][embeddings.index(x)]["index"])

        # Normalize
        vectors = np.array(embeddings, dtype=np.float32)
        normalized = normalize_l2(vectors)
        return normalized.tolist()

    async def aclose(self) -> None:
        await self._client.aclose()


class GeminiEmbedder:
    """Google Gemini embedding provider."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "models/text-embedding-004",
        batch_size: int = 100,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.batch_size = batch_size
        self._dimension = 768
        self._client = httpx.AsyncClient(
            base_url="https://generativelanguage.googleapis.com/v1beta",
            timeout=httpx.Timeout(60.0),
        )

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed texts in batches, return L2-normalized vectors."""
        all_vectors: list[list[float]] = []

        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            vectors = await self._embed_batch(batch)
            all_vectors.extend(vectors)

        return all_vectors

    async def _embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed a single batch."""
        response = await self._client.post(
            f"/{self.model}:batchEmbedContents",
            params={"key": self.api_key},
            json={
                "requests": [{"content": {"parts": [{"text": text}]}} for text in texts]
            },
        )
        response.raise_for_status()
        data = response.json()

        embeddings = [item["embedding"]["values"] for item in data["embeddings"]]

        # Normalize
        vectors = np.array(embeddings, dtype=np.float32)
        normalized = normalize_l2(vectors)
        return normalized.tolist()

    async def aclose(self) -> None:
        await self._client.aclose()


class LocalEmbedder:
    """Local sentence-transformers fallback (lazy-loaded)."""

    def __init__(
        self,
        *,
        model: str = "all-MiniLM-L6-v2",
        batch_size: int = 32,
    ) -> None:
        self.model_name = model
        self.batch_size = batch_size
        self._dimension = 384
        self._model = None

    @property
    def dimension(self) -> int:
        return self._dimension

    def _load_model(self):
        """Lazy load the sentence-transformers model."""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(self.model_name)
            except ImportError as exc:
                raise ImportError(
                    "sentence-transformers required for LocalEmbedder. "
                    "Install with: pip install sentence-transformers"
                ) from exc
        return self._model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed texts locally in batches."""
        import asyncio

        loop = asyncio.get_event_loop()

        all_vectors: list[list[float]] = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            vectors = await loop.run_in_executor(None, self._embed_batch_sync, batch)
            all_vectors.extend(vectors)

        return all_vectors

    def _embed_batch_sync(self, texts: list[str]) -> list[list[float]]:
        """Synchronous batch embedding."""
        model = self._load_model()
        embeddings = model.encode(
            texts, convert_to_numpy=True, normalize_embeddings=True
        )
        return embeddings.tolist()


class EmbedderFactory:
    """Factory for creating embedders based on configuration."""

    @staticmethod
    def create(
        *,
        provider: str,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
    ) -> Embedder:
        """Create an embedder instance."""
        if provider == "gemini":
            if not api_key:
                raise ValueError("Gemini embedder requires api_key")
            return GeminiEmbedder(
                api_key=api_key,
                model=model or "models/text-embedding-004",
            )
        elif provider == "openai":
            if not api_key:
                raise ValueError("OpenAI embedder requires api_key")
            return OpenAIEmbedder(
                api_key=api_key,
                model=model or "text-embedding-3-small",
                base_url=base_url,
            )
        elif provider == "local":
            return LocalEmbedder(model=model or "all-MiniLM-L6-v2")
        else:
            raise ValueError(f"Unknown embedder provider: {provider}")
