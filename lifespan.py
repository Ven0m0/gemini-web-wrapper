"""Lifespan management for FastAPI application.

This module handles application startup and shutdown,
including initialization and cleanup of resources.
"""

import sys
from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING, cast

import httpx
from contextlib import asynccontextmanager

from config import Settings
from cookie_manager import CookieManager
from gemini_client import GeminiClientWrapper
from llm_core.factory import ProviderFactory, ProviderType
from session_manager import SessionManager
from state import state

if TYPE_CHECKING:
    from fastapi import FastAPI


@asynccontextmanager
async def lifespan(app: "FastAPI") -> AsyncGenerator[None]:
    """Initialize and cleanup resources on app startup/shutdown.

    This context manager handles:
    - Loading configuration from environment/settings
    - Initializing the LLM provider with appropriate API key
    - Setting up session management, cookie management, and other services
    - Cleaning up resources on shutdown

    Args:
        app: FastAPI application instance.

    Yields:
        None: Control flow during application lifetime.

    Raises:
        SystemExit: If configuration loading fails.
    """
    try:
        state.settings = Settings()
    except (ValueError, KeyError, TypeError) as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)
    settings = state.settings

    # Initialize LLM Provider using Factory
    # Default to gemini if not specified or "google" (legacy)
    provider_type_raw = settings.model_provider
    if provider_type_raw == "google":
        provider_type_raw = "gemini"

    if provider_type_raw not in ("gemini", "anthropic", "copilot"):
        print(f"Unknown provider: {provider_type_raw}", file=sys.stderr)
        sys.exit(1)

    provider_type = cast(ProviderType, provider_type_raw)
    api_key = (
        settings.google_api_key
        if provider_type == "gemini"
        else settings.anthropic_api_key
    )
    state.llm_provider = ProviderFactory.create(
        provider_type,
        api_key=api_key,
        model_name=settings.model_name,
    )

    # Initialize lightweight session manager for user/session tracking
    state.session_manager = SessionManager()
    # Initialize cookie manager and gemini-webapi client
    state.cookie_manager = CookieManager(db_path="gemini_cookies.db")
    await state.cookie_manager.init_db()
    state.gemini_client = GeminiClientWrapper(state.cookie_manager)
    # Initialize shared GitHub client
    state.github_client = httpx.AsyncClient()
    yield
    # Cleanup: close async resources
    if state.gemini_client:
        await state.gemini_client.close()
    if state.github_client:
        await state.github_client.aclose()

    state.llm_provider = None
    state.session_manager = None
    state.settings = None
    state.cookie_manager = None
    state.gemini_client = None
    state.github_client = None
    state.attribution_cache.clear()