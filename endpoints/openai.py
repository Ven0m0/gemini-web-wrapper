"""OpenAI-compatible API endpoints.

This module contains endpoints that provide OpenAI-compatible functionality
for compatibility with existing clients and tools.
"""

import asyncio
import json
import sys
import time
from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from dependencies import get_gemini_client, get_settings
from gemini_client import GeminiClientWrapper
from models import GenResponse
from openai_transforms import (
    collapse_messages,
    parse_tool_calls,
    to_chat_completion_response,
)
from openai_schemas import ChatCompletionRequest, ChatCompletionResponse

if TYPE_CHECKING:
    from config import Settings


router = APIRouter(prefix="/v1", tags=["openai"])


async def _stream_gemini_sse(
    gemini_client: GeminiClientWrapper,
    prompt: str,
    model_name: str,
    request: ChatCompletionRequest,
    request_id: str,
    include_usage: bool,
) -> AsyncGenerator[str]:
    """Stream Gemini responses as OpenAI-compatible SSE chunks.

    Uses gemini-webapi native streaming for true incremental delivery.
    """
    created = int(time.time())
    effective_model = request.model or model_name
    first_chunk = True

    try:
        async for output in gemini_client.generate_stream(prompt, model=model_name):
            delta_text = output.text_delta or ""
            if not delta_text:
                continue

            delta: dict[str, str] = {"content": delta_text}
            if first_chunk:
                delta["role"] = "assistant"
                first_chunk = False

            chunk_data = {
                "id": request_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": effective_model,
                "choices": [
                    {
                        "index": 0,
                        "delta": delta,
                        "finish_reason": None,
                    }
                ],
            }
            yield f"data: {json.dumps(chunk_data)}\n\n"
    except Exception as e:
        # Log error but still send the finish marker
        print(f"Streaming generation error: {e}", file=sys.stderr)

    # Send finish chunk
    finish_chunk: dict[str, Any] = {
        "id": request_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": effective_model,
        "choices": [
            {
                "index": 0,
                "delta": {},
                "finish_reason": "stop",
            }
        ],
    }
    if include_usage:
        finish_chunk["usage"] = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }
    yield f"data: {json.dumps(finish_chunk)}\n\n"
    yield "data: [DONE]\n\n"


def _build_tool_call_response(
    tool_calls: list,
    remaining_text: str,
    request: ChatCompletionRequest,
    model_name: str,
    request_id: str,
) -> "ChatCompletionResponse":
    """Build a ChatCompletionResponse containing tool calls."""
    from openai_schemas import (
        ChatCompletionMessage as CCMessage,
        ChatCompletionResponse as CCResponse,
        ChatCompletionResponseChoice as CCChoice,
        ChatCompletionResponseUsage as CCUsage,
    )

    message = CCMessage(
        role="assistant",
        content=remaining_text if remaining_text else None,
        tool_calls=tool_calls,
    )
    choice = CCChoice(
        index=0,
        message=message,
        finish_reason="tool_calls",
    )
    return CCResponse(
        id=request_id,
        object="chat.completion",
        created=int(time.time()),
        model=request.model or model_name,
        choices=[choice],
        usage=CCUsage(),
    )


@router.post("/chat/completions", response_model=None)
async def openai_chat_completions(
    request: ChatCompletionRequest,
    gemini_client: GeminiClientWrapper = Depends(get_gemini_client),
    settings: "Settings" = Depends(get_settings),
) -> "ChatCompletionResponse | StreamingResponse":
    """OpenAI-compatible chat completions endpoint.

    This endpoint accepts OpenAI-style chat completion requests and translates them
    to Gemini API calls. It supports:
    - Message history with system/user/assistant roles
    - Tool calling via prompt injection
    - Streaming responses (SSE format)
    - Model aliasing (e.g., gpt-4o-mini -> gemini-2.5-flash)

    Args:
        request: ChatCompletionRequest with messages and optional tools.
        gemini_client: Injected GeminiClientWrapper dependency.
        settings: Injected Settings dependency.

    Returns:
        ChatCompletionResponse or StreamingResponse if streaming is enabled.

    Raises:
        HTTPException: 503 if client not initialized, 502 if generation fails.
    """
    # Initialize client if needed (auto-import cookies)
    if not await gemini_client.ensure_initialized():
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

    # Resolve model name (handle aliases)
    model_name = settings.resolve_model(request.model)
    # Collapse messages into a single prompt
    prompt = collapse_messages(request)
    # Generate request ID
    request_id = f"chatcmpl-{uuid4().hex}"

    # Determine streaming options
    is_streaming = request.stream
    stream_options = getattr(request, "stream_options", {}) or {}
    include_usage = stream_options.get("include_usage", False)

    if is_streaming:
        # Use native gemini-webapi streaming
        return StreamingResponse(
            _stream_gemini_sse(
                gemini_client,
                prompt,
                model_name,
                request,
                request_id,
                include_usage,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

    # Non-streaming: generate full response
    try:
        raw_response = await asyncio.wait_for(
            gemini_client.generate(prompt, model=model_name),
            timeout=30.0,
        )
    except TimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Gemini generation timed out after 30s",
        ) from e
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini generation failed: {exc}",
        ) from exc

    # Parse for tool calls
    text = raw_response.text or ""
    tool_calls: list = []
    if request.tools and request.tool_choice != "none":
        tool_calls, text = parse_tool_calls(text)

    if tool_calls:
        # Build a tool-call response manually
        return _build_tool_call_response(
            tool_calls, text, request, model_name, request_id
        )

    return to_chat_completion_response(raw_response, request, model_name)


@router.get("/models")
async def get_models():
    """Get available models, similar to OpenAI API."""
    return {
        "data": [
            {
                "id": "gemini-2.5-flash",
                "object": "model",
                "created": 1677610602,
                "owned_by": "google",
            },
            {
                "id": "gemini-2.5-pro",
                "object": "model",
                "created": 1677610602,
                "owned_by": "google",
            },
            {
                "id": "gemini-3.0-pro",
                "object": "model",
                "created": 1677610602,
                "owned_by": "google",
            },
        ]
    }