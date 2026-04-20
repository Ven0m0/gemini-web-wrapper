"""Utility functions for Affine API."""

from __future__ import annotations

from affine.code_index import Embedder, EmbedderFactory
from affine.config.settings import Settings


def create_local_embedder(settings: Settings) -> Embedder:
    """Factory for creating an embedder based on application settings."""
    provider = settings.model_provider
    api_key = settings.provider_api_key()
    base_url = settings.provider_base_url()

    if provider == "gemini" and settings.google_api_key:
        return EmbedderFactory.create(
            provider="gemini",
            api_key=settings.google_api_key,
        )
    elif api_key:
        return EmbedderFactory.create(
            provider="openai",
            api_key=api_key,
            base_url=base_url,
        )

    raise ValueError("No API key configured for embedding")
