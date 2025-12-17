#!/usr/bin/env python3
"""Gemini WebAPI client integration with cookie management.

This module provides a wrapper around gemini-webapi that integrates with
our cookie manager for seamless authentication and multi-profile support.
"""

import asyncio
import logging
from typing import Any

from gemini_webapi import GeminiClient as BaseGeminiClient

from cookie_manager import CookieManager

logger = logging.getLogger(__name__)


class GeminiClientWrapper:
    """Wrapper for gemini-webapi with cookie management integration.

    This class handles:
    - Automatic cookie loading from profiles
    - Fallback to browser-cookie3 auto-import
    - Cookie refresh on authentication failures
    - Thread-safe client initialization

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
        self.client: BaseGeminiClient | None = None
        self._lock = asyncio.Lock()

    async def init_with_profile(self, profile_name: str) -> bool:
        """Initialize client with a specific profile.

        Args:
            profile_name: Name of the profile to use.

        Returns:
            True if initialization succeeded, False otherwise.
        """
        async with self._lock:
            # Get cookies from profile
            cookies = await self.cookie_manager.get_gemini_cookies(profile_name)

            if not cookies:
                logger.error(
                    f"Failed to load valid cookies from profile '{profile_name}'"
                )
                return False

            # Extract required cookie values
            secure_1psid = cookies.get("__Secure-1PSID")
            secure_1psidts = cookies.get("__Secure-1PSIDTS")

            if not secure_1psid or not secure_1psidts:
                logger.error(
                    f"Missing required cookies in profile '{profile_name}'"
                )
                return False

            try:
                # Initialize client with cookies in thread pool
                self.client = await asyncio.to_thread(
                    BaseGeminiClient,
                    secure_1psid,
                    secure_1psidts,
                    proxy=None,
                )
                self.profile_name = profile_name
                logger.info(
                    f"Initialized Gemini client with profile '{profile_name}'"
                )
                return True

            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
                return False

    async def init_auto(self) -> bool:
        """Initialize client with automatic browser cookie import.

        Uses browser-cookie3 to automatically import cookies from the browser.
        This requires the user to be logged in to gemini.google.com.

        Returns:
            True if initialization succeeded, False otherwise.
        """
        async with self._lock:
            try:
                # Let gemini-webapi auto-import cookies via browser-cookie3
                self.client = await asyncio.to_thread(BaseGeminiClient)
                self.profile_name = None
                logger.info(
                    "Initialized Gemini client with auto browser cookies"
                )
                return True

            except Exception as e:
                logger.error(f"Failed to auto-initialize Gemini client: {e}")
                return False

    async def ensure_initialized(self) -> bool:
        """Ensure the client is initialized.

        Returns:
            True if client is ready, False otherwise.
        """
        return self.client is not None

    async def generate(
        self,
        prompt: str,
        image: bytes | None = None,
    ) -> str:
        """Generate a response from Gemini.

        Args:
            prompt: Text prompt for generation.
            image: Optional image bytes for multimodal generation.

        Returns:
            Generated text response.

        Raises:
            RuntimeError: If client is not initialized.
            Exception: If generation fails.
        """
        if not self.client:
            raise RuntimeError("Gemini client not initialized")

        try:
            # Run generation in thread pool (blocking I/O)
            if image:
                response = await asyncio.to_thread(
                    self.client.generate_content,
                    prompt,
                    image=image,
                )
            else:
                response = await asyncio.to_thread(
                    self.client.generate_content,
                    prompt,
                )

            return str(response.text if hasattr(response, "text") else response)

        except Exception as e:
            logger.error(f"Generation failed: {e}")

            # Try to refresh cookies if using a profile
            if self.profile_name:
                logger.info(
                    f"Attempting to refresh profile '{self.profile_name}'"
                )
                if await self.cookie_manager.refresh_profile(
                    self.profile_name
                ) and await self.init_with_profile(self.profile_name):
                    # Retry generation once
                    return await self.generate(prompt, image)

            raise

    async def chat(
        self,
        message: str,
        conversation_id: str | None = None,
    ) -> tuple[str, str]:
        """Send a chat message and get response.

        Args:
            message: User message.
            conversation_id: Optional conversation ID to continue a chat.

        Returns:
            Tuple of (response_text, conversation_id).

        Raises:
            RuntimeError: If client is not initialized.
            Exception: If chat fails.
        """
        if not self.client:
            raise RuntimeError("Gemini client not initialized")

        try:
            # Run chat in thread pool (blocking I/O)
            kwargs = (
                {"conversation_id": conversation_id} if conversation_id else {}
            )
            response = await asyncio.to_thread(
                self.client.send_message,
                message,
                **kwargs,
            )

            # Extract response text and conversation ID
            response_text = str(
                response.text if hasattr(response, "text") else response
            )

            # Get conversation ID from response or client
            conv_id = (
                getattr(response, "conversation_id", None)
                or getattr(self.client, "conversation_id", None)
                or conversation_id
                or "default"
            )

            return response_text, conv_id

        except Exception as e:
            logger.error(f"Chat failed: {e}")

            # Try to refresh cookies if using a profile
            if self.profile_name:
                logger.info(
                    f"Attempting to refresh profile '{self.profile_name}'"
                )
                if await self.cookie_manager.refresh_profile(
                    self.profile_name
                ) and await self.init_with_profile(self.profile_name):
                    # Retry chat once
                    return await self.chat(message, conversation_id)

            raise

    async def get_conversation_history(
        self,
        conversation_id: str,
    ) -> list[dict[str, Any]]:
        """Get conversation history.

        Args:
            conversation_id: Conversation ID to fetch history for.

        Returns:
            List of message dictionaries.

        Raises:
            RuntimeError: If client is not initialized.
        """
        if not self.client:
            raise RuntimeError("Gemini client not initialized")

        try:
            # Run in thread pool (blocking I/O)
            history = await asyncio.to_thread(
                self.client.get_conversation,
                conversation_id,
            )

            return history if history else []

        except Exception as e:
            logger.error(f"Failed to get conversation history: {e}")
            return []

    async def list_conversations(self) -> list[dict[str, Any]]:
        """List all conversations.

        Returns:
            List of conversation metadata dictionaries.

        Raises:
            RuntimeError: If client is not initialized.
        """
        if not self.client:
            raise RuntimeError("Gemini client not initialized")

        try:
            # Run in thread pool (blocking I/O)
            conversations = await asyncio.to_thread(
                self.client.list_conversations,
            )

            return conversations if conversations else []

        except Exception as e:
            logger.error(f"Failed to list conversations: {e}")
            return []

    async def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation.

        Args:
            conversation_id: Conversation ID to delete.

        Returns:
            True if deletion succeeded, False otherwise.

        Raises:
            RuntimeError: If client is not initialized.
        """
        if not self.client:
            raise RuntimeError("Gemini client not initialized")

        try:
            # Run in thread pool (blocking I/O)
            await asyncio.to_thread(
                self.client.delete_conversation,
                conversation_id,
            )
            return True

        except Exception as e:
            logger.error(f"Failed to delete conversation: {e}")
            return False

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
