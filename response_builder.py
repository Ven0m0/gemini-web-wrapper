"""Response building utilities for OpenAI-compatible responses.

This module contains functions for building OpenAI-compatible responses
from Gemini ModelOutput objects.
"""

import time
from typing import Any

from gemini_webapi import ModelOutput

from message_transforms import parse_tool_calls
from openai_schemas import (
    ChatCompletionMessage,
    ChatCompletionMessageContent,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionResponseChoice,
    ChatCompletionResponseUsage,
    ToolCall,
)

from uuid import uuid4


def to_chat_completion_response(
    output: ModelOutput,
    request: ChatCompletionRequest,
    resolved_model: str,
) -> ChatCompletionResponse:
    """Convert Gemini ModelOutput to an OpenAI-compatible response."""
    text = output.text or ""

    # Parse for tool calls if tools were provided
    tool_calls: list[ToolCall] = []
    remaining_text = text
    if request.tools and request.tool_choice != "none":
        tool_calls, remaining_text = parse_tool_calls(text)

    # Build the response message
    if tool_calls:
        # Tool call response - content can be null or the remaining text
        message = ChatCompletionMessage(
            role="assistant",
            content=remaining_text if remaining_text else None,
            tool_calls=tool_calls,
        )
        finish_reason = "tool_calls"
    else:
        # Regular text response
        message = ChatCompletionMessage(
            role="assistant",
            content=[ChatCompletionMessageContent(type="text", text=remaining_text)],
        )
        finish_reason = "stop"

    choice = ChatCompletionResponseChoice(
        index=0,
        message=message,
        finish_reason=finish_reason,  # type: ignore
    )

    usage_info = getattr(output, "usage", None)
    usage = ChatCompletionResponseUsage(
        prompt_tokens=getattr(usage_info, "prompt_tokens", None),
        completion_tokens=getattr(usage_info, "candidates_tokens", None),
        total_tokens=getattr(usage_info, "total_tokens", None),
    )

    return ChatCompletionResponse(
        id=f"chatcmpl-{uuid4().hex}",
        object="chat.completion",
        created=int(time.time()),
        model=request.model or resolved_model,
        choices=[choice],
        usage=usage,
        system_fingerprint=getattr(output, "system_fingerprint", None),
    )