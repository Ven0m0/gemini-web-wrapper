"""Gemini WebAPI endpoints.

This module contains endpoints that use the gemini-webapi library
directly for cookie-based authentication and web features.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from dependencies import get_gemini_client
from gemini_client import GeminiClientWrapper
from models import GeminiChatReq

router = APIRouter(prefix="/gemini", tags=["gemini"])


@router.post("/chat")
async def gemini_chat(
    r: GeminiChatReq,
    gemini_client: GeminiClientWrapper = Depends(get_gemini_client),
) -> dict[str, Any]:
    """Chat using gemini-webapi with cookie authentication.

    This endpoint uses the gemini-webapi library directly instead of Genkit,
    allowing for cookie-based authentication and access to web features.

    Args:
        r: GeminiChatReq with message and optional conversation ID.
        gemini_client: Injected GeminiClientWrapper dependency.

    Returns:
        Dict with response text and conversation ID.

    Raises:
        HTTPException: 503 if client not initialized, 400 if profile fails, 500 if chat fails.
    """
    # Initialize with profile if specified
    if r.profile:
        success = await gemini_client.init_with_profile(r.profile)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(f"Failed to initialize with profile '{r.profile}'"),
            )
    # Otherwise try auto-init if not already initialized
    elif not await gemini_client.ensure_initialized():
        success = await gemini_client.init_auto()
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Failed to auto-initialize. "
                    "Please login to gemini.google.com "
                    "or create a profile."
                ),
            )
    try:
        output, conversation_id = await gemini_client.chat(
            r.message,
            r.conversation_id,
        )
        return {
            "text": output.text or "",
            "conversation_id": conversation_id,
            "profile": gemini_client.get_current_profile(),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat failed: {e}",
        ) from e