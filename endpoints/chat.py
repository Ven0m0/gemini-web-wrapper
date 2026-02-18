"""Chat and chatbot API endpoints.

This module contains endpoints for basic chat functionality and
chatbot with conversation history.
"""

import asyncio
import sys
from collections.abc import AsyncGenerator, Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from dependencies import get_llm_provider, get_session_manager
from llm_core.interfaces import LLMProvider
from models import ChatbotReq, ChatReq, GenResponse
from session_manager import SessionManager
from state import state
from utils import handle_generation_errors

router = APIRouter(prefix="/chat", tags=["chat"])


async def run_generate(
    prompt: str,
    model: LLMProvider,
    *,
    system: str | None = None,
    history: Sequence[dict[str, str]] | None = None,
    timeout: float = 30.0,
) -> str:
    """Run model generation with a timeout.

    Args:
        prompt: User prompt.
        model: Initialized LLMProvider instance.
        system: Optional system instruction.
        history: Optional conversation history.
        timeout: Maximum time to wait for generation (default 30 seconds).

    Returns:
        Generated text.
    """
    try:
        return await asyncio.wait_for(
            model.generate(prompt, system=system, history=history),
            timeout=timeout,
        )
    except TimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Model generation timed out after {timeout}s",
        ) from e


async def _setup_session_attribution(
    session_mgr: SessionManager,
    user_id: str | None,
    session_id: str | None,
) -> None:
    """Set up session attribution for conversation tracking.

    Args:
        session_mgr: Initialized SessionManager instance.
        user_id: Optional user identifier (defaults to "default_user").
        session_id: Optional session identifier for grouping interactions.
    """
    if user_id or session_id:
        # Create cache key from user_id and session_id
        effective_user_id = user_id or "default_user"
        effective_session_id = session_id or "__no_session__"
        cache_key = (effective_user_id, effective_session_id)

        # Only set up attribution if not already cached
        if cache_key not in state.attribution_cache:
            session_mgr.attribution(
                entity_id=effective_user_id,
                process_id="gemini-chatbot",
            )
            if session_id:  # Only set session if explicitly provided
                session_mgr.set_session(session_id)
            # Add to cache (TTLCache expires after 1 hour)
            state.attribution_cache[cache_key] = True


@router.post("", response_model=GenResponse)
@handle_generation_errors
async def chat(
    r: ChatReq,
    model: LLMProvider = Depends(get_llm_provider),
) -> dict[str, str]:
    """Handle conversational chat requests."""
    text = await run_generate(r.prompt, model, system=r.system)
    return {"text": text}


@router.post("/code", response_model=GenResponse)
@handle_generation_errors
async def code(
    r: ChatReq,
    model: LLMProvider = Depends(get_llm_provider),
) -> dict[str, str]:
    """Handle code assistance requests."""
    prompt = "\n".join(
        [
            "You are a coding assistant.",
            "Apply the following instruction to the code.",
            "",
            "Instruction:",
            r.prompt,
        ]
    )
    text = await run_generate(prompt, model)
    return {"text": text}


@router.post("/bot", response_model=GenResponse)
@handle_generation_errors
async def chatbot(
    r: ChatbotReq,
    model: LLMProvider = Depends(get_llm_provider),
    session_mgr: SessionManager = Depends(get_session_manager),
) -> dict[str, str]:
    """Handle chatbot requests with conversation history."""
    await _setup_session_attribution(session_mgr, r.user_id, r.session_id)
    history_dicts = (
        [{"role": m.role, "content": m.content} for m in r.history]
        if r.history
        else None
    )
    text = await run_generate(
        r.message,
        model,
        system=r.system,
        history=history_dicts,
    )
    return {"text": text}


@router.post("/bot/stream")
async def chatbot_stream(
    r: ChatbotReq,
    model: LLMProvider = Depends(get_llm_provider),
    session_mgr: SessionManager = Depends(get_session_manager),
):
    """Handle chatbot requests with streaming responses."""

    await _setup_session_attribution(session_mgr, r.user_id, r.session_id)
    history_dicts = (
        [{"role": m.role, "content": m.content} for m in r.history]
        if r.history
        else None
    )

    async def generate_stream() -> AsyncGenerator[str]:
        try:
            async for chunk in model.stream(
                r.message,
                system=r.system,
                history=history_dicts,
            ):
                yield chunk
        except Exception as e:
            # Log detailed error server-side, but return a generic message to the client
            print(f"chatbot_stream generation error: {e}", file=sys.stderr)
            yield "Error: Generation failed"

    return StreamingResponse(generate_stream(), media_type="text/plain")


@router.get("/health")
async def health() -> dict[str, bool]:
    """Health check endpoint.

    Returns:
        Dict with 'ok: True' indicating service is running.
    """
    return {"ok": True}