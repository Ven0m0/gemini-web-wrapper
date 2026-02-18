"""FastAPI dependency functions.

This module provides dependency injection functions for accessing
initialized application services like LLM providers, session managers, etc.
"""

from typing import cast

import httpx
from fastapi import Depends, HTTPException, status

from config import Settings
from cookie_manager import CookieManager
from gemini_client import GeminiClientWrapper
from llm_core.interfaces import LLMProvider
from session_manager import SessionManager
from state import AppState, state


# ----- Dependency Functions -----


def get_llm_provider() -> LLMProvider:
    """FastAPI dependency to get the initialized model.

    Returns:
        Initialized LLMProvider instance.

    Raises:
        HTTPException: 503 if provider is not initialized.
    """
    if state.llm_provider is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM Provider not initialized. Check server logs.",
        )
    return state.llm_provider


def get_session_manager() -> SessionManager:
    """FastAPI dependency to get the initialized SessionManager instance.

    Returns:
        Initialized SessionManager instance.

    Raises:
        HTTPException: 503 if SessionManager is not initialized.
    """
    if state.session_manager is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session manager not initialized. Check server logs.",
        )
    return state.session_manager


def get_cookie_manager() -> CookieManager:
    """FastAPI dependency to get the initialized CookieManager.

    Returns:
        Initialized CookieManager instance.

    Raises:
        HTTPException: 503 if CookieManager is not initialized.
    """
    if state.cookie_manager is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cookie manager not initialized.",
        )
    return state.cookie_manager


def get_gemini_client() -> GeminiClientWrapper:
    """FastAPI dependency to get the initialized GeminiClientWrapper.

    Returns:
        Initialized GeminiClientWrapper instance.

    Raises:
        HTTPException: 503 if GeminiClientWrapper is not initialized.
    """
    if state.gemini_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini client not initialized.",
        )
    return state.gemini_client


def get_github_client() -> httpx.AsyncClient:
    """FastAPI dependency to get the initialized GitHub client.

    Returns:
        Initialized httpx.AsyncClient instance.

    Raises:
        HTTPException: 503 if client is not initialized.
    """
    if state.github_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub client not initialized.",
        )
    return state.github_client


def get_settings() -> Settings:
    """FastAPI dependency to get the cached Settings instance.

    Returns:
        Cached Settings instance loaded at startup.

    Raises:
        HTTPException: 503 if Settings is not initialized.
    """
    if state.settings is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Settings not initialized.",
        )
    return state.settings


def get_state() -> AppState:
    """FastAPI dependency to get the application state.

    Returns:
        Global application state instance.
    """
    return state