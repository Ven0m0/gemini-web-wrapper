"""Application state management using dataclasses.

This module provides the AppState class that holds global application state
for LLM providers, session management, and other resources.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import httpx
from cachetools import TTLCache

from config import Settings
from cookie_manager import CookieManager
from gemini_client import GeminiClientWrapper
from llm_core.interfaces import LLMProvider
from session_manager import SessionManager


@dataclass
class AppState:
    """Global application state for LLM providers and session management.

    Uses dataclass to ensure proper instance attribute initialization
    and avoid mutable class attribute anti-pattern.
    """

    llm_provider: LLMProvider | None = None
    session_manager: SessionManager | None = None
    chatbot_flow: Callable[..., Any] | None = None
    settings: Settings | None = None
    # Cache for session setup with TTL to prevent unbounded growth
    # maxsize=10000 entries, ttl=3600 seconds (1 hour)
    attribution_cache: TTLCache = field(
        default_factory=lambda: TTLCache(maxsize=10000, ttl=3600)
    )
    # Cookie management for gemini-webapi
    cookie_manager: CookieManager | None = None
    gemini_client: GeminiClientWrapper | None = None
    github_client: httpx.AsyncClient | None = None


# Global state instance
state = AppState()
