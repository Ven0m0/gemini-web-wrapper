#!/usr/bin/env python3
"""Gemini WebAPI client integration with cookie management.

This module provides an async wrapper around gemini-webapi that integrates
with our cookie manager for seamless authentication, multi-profile support,
streaming, and ChatSession-based multi-turn conversations.
"""

import logging
from collections.abc import AsyncGenerator
from typing import Any

from gemini_webapi import ChatSession, GeminiClient
from gemini_webapi.types import ModelOutput

from cookie_manager import CookieManager

logger = logging.getLogger(__name__)


class GeminiClientWrapper:
    """Async wrapper for gemini-webapi with cookie management integration.

    This class handles:
    - Automatic cookie loading from profiles
    - Fallback to rookiepy auto-import
    - Cookie refresh on authentication failures
    - Proper async client lifecycle (init/close)
    - Streaming via generate_content_stream
    - Multi-turn conversations via ChatSession

    Attributes:
        cookie_manager: CookieManager instance for profile management.
        profile_name: Currently active profile name (if any).
        client: Underlying GeminiClient instance.
    """

    def __init__(self, cookie_manager: CookieManager) -> None:
        """Initialize the Gemini client wrapper.

        Args:
            cookie_manager: Initialized CookieManager instance.
        """
        self.cookie_manager = cookie_manager
        self.profile_name: str | None = None
        self.client: GeminiClient | None = None
        self._chat_sessions: dict[str, ChatSession] = {}

    async def init_with_profile(self, profile_name: str) -> bool:
        """Initialize client with a specific cookie profile.

        Args:
            profile_name: Name of the profile to use.

        Returns:
            True if initialization succeeded, False otherwise.
        """
        cookies = await self.cookie_manager.get_gemini_cookies(profile_name)
        if not cookies:
            logger.error(
                "Failed to load valid cookies from profile '%s'",
                profile_name,
            )
            return False

        secure_1psid = cookies.get("__Secure-1PSID")
        secure_1psidts = cookies.get("__Secure-1PSIDTS")

        if not secure_1psid or not secure_1psidts:
            logger.error("Missing required cookies in profile '%s'", profile_name)
            return False

        try:
            # Close existing client if any
            await self.close()

            self.client = GeminiClient(secure_1psid, secure_1psidts)
            await self.client.init(timeout=30, auto_close=False)
            self.profile_name = profile_name
            self._chat_sessions.clear()
            logger.info(
                "Initialized Gemini client with profile '%s'",
                profile_name,
            )
            return True
        except Exception:
            logger.exception("Failed to initialize Gemini client")
            self.client = None
            return False

    async def init_auto(self) -> bool:
        """Initialize client with automatic browser cookie import.

        Uses rookiepy to automatically import cookies from the
        user's browser. Requires the user to be logged in at
        gemini.google.com.

        Returns:
            True if initialization succeeded, False otherwise.
        """
        try:
            await self.close()

            self.client = GeminiClient()
            await self.client.init(timeout=30, auto_close=False)
            self.profile_name = None
            self._chat_sessions.clear()
            logger.info("Initialized Gemini client with auto browser cookies")
            return True
        except Exception:
            logger.exception("Failed to auto-initialize Gemini client")
            self.client = None
            return False

    async def close(self) -> None:
        """Close the underlying client and release resources."""
        if self.client is not None:
            try:
                await self.client.close()
            except Exception:
                logger.debug("Error closing Gemini client", exc_info=True)
            self.client = None
        self._chat_sessions.clear()

    async def ensure_initialized(self) -> bool:
        """Check whether the client is initialized and ready.

        Returns:
            True if the client is ready, False otherwise.
        """
        return self.client is not None

    async def generate(
        self,
        prompt: str,
        *,
        model: str | None = None,
    ) -> ModelOutput:
        """Generate a single-turn response.

        Args:
            prompt: Text prompt for generation.
            model: Optional model name override.

        Returns:
            ModelOutput with text, images, and metadata.

        Raises:
            RuntimeError: If client is not initialized.
        """
        if not self.client:
            raise RuntimeError("Gemini client not initialized")

        try:
            kwargs: dict[str, Any] = {}
            if model:
                kwargs["model"] = model
            return await self.client.generate_content(prompt, **kwargs)
        except Exception as e:
            logger.error("Generation failed: %s", e)
            if await self._try_refresh():
                return await self.client.generate_content(prompt, **kwargs)  # type: ignore[union-attr]
            raise

    async def generate_stream(
        self,
        prompt: str,
        *,
        model: str | None = None,
    ) -> AsyncGenerator[ModelOutput]:
        """Stream a single-turn response, yielding partial outputs.

        Each yielded ModelOutput contains incremental ``text_delta``
        and ``thoughts_delta`` fields for progressive rendering.

        Args:
            prompt: Text prompt for generation.
            model: Optional model name override.

        Yields:
            ModelOutput objects with incremental deltas.

        Raises:
            RuntimeError: If client is not initialized.
        """
        if not self.client:
            raise RuntimeError("Gemini client not initialized")

        kwargs: dict[str, Any] = {}
        if model:
            kwargs["model"] = model

        async for output in self.client.generate_content_stream(prompt, **kwargs):
            yield output

    async def chat(
        self,
        message: str,
        conversation_id: str | None = None,
        *,
        model: str | None = None,
    ) -> tuple[ModelOutput, str]:
        """Send a chat message in a multi-turn conversation.

        Creates or reuses a ChatSession for the given conversation_id.

        Args:
            message: User message text.
            conversation_id: Optional session key. A new session is
                created when None or not found.
            model: Optional model name override.

        Returns:
            Tuple of (ModelOutput, conversation_id).

        Raises:
            RuntimeError: If client is not initialized.
        """
        if not self.client:
            raise RuntimeError("Gemini client not initialized")

        session = self._get_or_create_session(conversation_id, model=model)
        conv_id = conversation_id or id(session).__str__()

        try:
            output = await session.send_message(message)
            # Store session for reuse
            self._chat_sessions[conv_id] = session
            return output, conv_id
        except Exception as e:
            logger.error("Chat failed: %s", e)
            if await self._try_refresh():
                # After refresh we need a new session
                session = self.client.start_chat()  # type: ignore[union-attr]
                output = await session.send_message(message)
                self._chat_sessions[conv_id] = session
                return output, conv_id
            raise

    async def chat_stream(
        self,
        message: str,
        conversation_id: str | None = None,
        *,
        model: str | None = None,
    ) -> AsyncGenerator[tuple[ModelOutput, str]]:
        """Stream a chat message response with incremental deltas.

        Args:
            message: User message text.
            conversation_id: Optional session key.
            model: Optional model name override.

        Yields:
            Tuple of (ModelOutput with deltas, conversation_id).

        Raises:
            RuntimeError: If client is not initialized.
        """
        if not self.client:
            raise RuntimeError("Gemini client not initialized")

        session = self._get_or_create_session(conversation_id, model=model)
        conv_id = conversation_id or id(session).__str__()

        async for output in session.send_message_stream(message):
            yield output, conv_id

        # Store session for reuse after streaming completes
        self._chat_sessions[conv_id] = session

    def get_current_profile(self) -> str | None:
        """Get the currently active profile name.

        Returns:
            Profile name if using a profile, None if using auto-import.
        """
        return self.profile_name

    async def switch_profile(self, profile_name: str) -> bool:
        """Switch to a different profile.

        Args:
            profile_name: Name of the profile to switch to.

        Returns:
            True if switch succeeded, False otherwise.
        """
        return await self.init_with_profile(profile_name)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_or_create_session(
        self,
        conversation_id: str | None,
        *,
        model: str | None = None,
    ) -> ChatSession:
        """Return an existing ChatSession or create a new one."""
        if conversation_id and conversation_id in self._chat_sessions:
            return self._chat_sessions[conversation_id]

        if not self.client:
            raise RuntimeError("Gemini client not initialized")

        kwargs: dict[str, Any] = {}
        if model:
            kwargs["model"] = model
        return self.client.start_chat(**kwargs)

    async def _try_refresh(self) -> bool:
        """Attempt to refresh cookies and reinitialize the client.

        Returns:
            True if refresh succeeded and client is ready.
        """
        if not self.profile_name:
            return False

        logger.info("Attempting to refresh profile '%s'", self.profile_name)
        refreshed = await self.cookie_manager.refresh_profile(self.profile_name)
        if refreshed:
            return await self.init_with_profile(self.profile_name)
        return False
