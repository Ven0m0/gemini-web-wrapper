"""FastAPI dependencies for state validation and resource access.

This module provides reusable FastAPI dependencies that validate application
state and provide type-safe access to resources like the model, memori
instance, and cookie manager.
"""

from typing import Protocol

from fastapi import Depends, HTTPException, status
from memori import Memori

from cookie_manager import CookieManager
from gemini_client import GeminiClientWrapper

# ----- Type Protocols -----


class GenerateResponse(Protocol):
    """Protocol defining the response from model generation."""

    @property
    def text(self) -> str:
        """Generated text from the model."""
        ...


class GenkitModel(Protocol):
    """Protocol defining the interface for Genkit model objects."""

    def generate(
        self,
        messages: str | list[dict[str, str]],
    ) -> GenerateResponse:
        """Generate a response from the model.

        Args:
            messages: Either a string prompt or structured message list.

        Returns:
            GenerateResponse containing the generated text.
        """
        ...


# ----- State Management (Import from server.py) -----


def get_state() -> "AppState":  # type: ignore
    """Get the application state.

    This is a placeholder that will be imported from server.py
    to avoid circular dependencies.

    Returns:
        Application state instance.
    """
    from server import state

    return state


# ----- Dependencies -----


def require_model(
    app_state: "AppState" = Depends(get_state),  # type: ignore
) -> GenkitModel:
    """Dependency that ensures the model is initialized.

    Args:
        app_state: Application state from get_state dependency.

    Returns:
        Initialized GenkitModel instance.

    Raises:
        HTTPException: 503 if model is not initialized.

    Example:
        >>> @app.post("/generate")
        >>> async def generate(
        ...     prompt: str,
        ...     model: GenkitModel = Depends(require_model),
        ... ) -> str:
        ...     response = await run_in_thread(model.generate, prompt)
        ...     return response.text
    """
    if app_state.model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not initialized. Check server logs.",
        )
    return app_state.model


def require_memori(
    app_state: "AppState" = Depends(get_state),  # type: ignore
) -> Memori:
    """Dependency that ensures Memori is initialized.

    Args:
        app_state: Application state from get_state dependency.

    Returns:
        Initialized Memori instance.

    Raises:
        HTTPException: 503 if Memori is not initialized.

    Example:
        >>> @app.post("/memory/query")
        >>> async def query_memory(
        ...     query: str,
        ...     memori: Memori = Depends(require_memori),
        ... ) -> dict[str, Any]:
        ...     results = await memori.search(query)
        ...     return {"results": results}
    """
    if app_state.memori is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Memori not initialized. Check server logs.",
        )
    return app_state.memori


def require_gemini_client(
    app_state: "AppState" = Depends(get_state),  # type: ignore
) -> GeminiClientWrapper:
    """Dependency that ensures Gemini client is initialized.

    Args:
        app_state: Application state from get_state dependency.

    Returns:
        Initialized GeminiClientWrapper instance.

    Raises:
        HTTPException: 503 if Gemini client is not initialized.

    Example:
        >>> @app.post("/gemini/chat")
        >>> async def gemini_chat(
        ...     message: str,
        ...     client: GeminiClientWrapper = Depends(require_gemini_client),
        ... ) -> dict[str, Any]:
        ...     response = await client.generate(message)
        ...     return {"response": response}
    """
    if app_state.gemini_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini client not initialized. Check server configuration.",
        )
    return app_state.gemini_client


def require_cookie_manager(
    app_state: "AppState" = Depends(get_state),  # type: ignore
) -> CookieManager:
    """Dependency that ensures Cookie Manager is initialized.

    Args:
        app_state: Application state from get_state dependency.

    Returns:
        Initialized CookieManager instance.

    Raises:
        HTTPException: 503 if Cookie Manager is not initialized.

    Example:
        >>> @app.post("/profiles/create")
        >>> async def create_profile(
        ...     name: str,
        ...     manager: CookieManager = Depends(require_cookie_manager),
        ... ) -> dict[str, Any]:
        ...     await manager.create_profile(name)
        ...     return {"status": "created"}
    """
    if app_state.cookie_manager is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cookie manager not initialized. Check server configuration.",
        )
    return app_state.cookie_manager


# Re-export AppState type for use in dependencies
# This will be properly typed when imported from server.py
__all__ = [
    "GenerateResponse",
    "GenkitModel",
    "get_state",
    "require_cookie_manager",
    "require_gemini_client",
    "require_memori",
    "require_model",
]
