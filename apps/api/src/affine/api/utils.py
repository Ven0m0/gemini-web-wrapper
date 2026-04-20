from affine.config.settings import Settings
from affine.code_index import EmbedderFactory


def create_local_embedder(settings: Settings):
    """Factory for embedder based on settings."""
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
    return None
