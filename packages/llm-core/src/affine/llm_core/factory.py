"""LLM provider factory.

Creates provider instances via structural match dispatch on ProviderConfig.
"""

from typing import TYPE_CHECKING

from affine.llm_core.interfaces import LLMProvider

if TYPE_CHECKING:
    from affine.shared.provider_config import ProviderConfig


_PROVIDER_REGISTRY: dict[str, type[LLMProvider]] = {}


def register_provider(name: str) -> type[LLMProvider]:
    """Decorator to register a provider class."""

    def decorator(cls: type[LLMProvider]) -> type[LLMProvider]:
        _PROVIDER_REGISTRY[name] = cls
        return cls

    return decorator


def create_provider(config: "ProviderConfig") -> LLMProvider:
    """Create an LLM provider instance from configuration.

    Uses structural match on ProviderConfig.type to dispatch to the
    correct provider class.

    Args:
        config: Provider configuration containing type and credentials.

    Returns:
        Initialized LLM provider instance.

    Raises:
        ValueError: If provider type is unknown or not configured.
    """
    from affine.llm_core.providers.gemini import GoogleProvider
    from affine.llm_core.providers.anthropic import AnthropicProvider
    from affine.llm_core.providers.copilot import CopilotProvider
    from affine.llm_core.providers.bifrost import BifrostProvider

    # Ensure all providers are registered
    if "gemini" not in _PROVIDER_REGISTRY:
        _PROVIDER_REGISTRY["gemini"] = GoogleProvider
    if "anthropic" not in _PROVIDER_REGISTRY:
        _PROVIDER_REGISTRY["anthropic"] = AnthropicProvider
    if "copilot" not in _PROVIDER_REGISTRY:
        _PROVIDER_REGISTRY["copilot"] = CopilotProvider
    if "bifrost" not in _PROVIDER_REGISTRY:
        _PROVIDER_REGISTRY["bifrost"] = BifrostProvider

    provider_type = config.type
    provider_cls = _PROVIDER_REGISTRY.get(provider_type)

    if provider_cls is None:
        raise ValueError(f"Unknown provider type: {provider_type!r}")

    return provider_cls(config)


__all__ = [
    "create_provider",
    "register_provider",
]
