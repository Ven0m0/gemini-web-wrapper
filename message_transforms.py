"""Message transformation utilities for OpenAI-style payloads.

This module contains functions for transforming between OpenAI chat
message formats and internal representations.
"""

import json
from typing import Any

from openai_schemas import (
    ChatCompletionMessage,
    ChatCompletionMessageContent,
    ChatCompletionRequest,
    ToolDefinition,
)

from tool_parsing import inject_tools_into_prompt


def format_tool_result_for_prompt(tool_call_id: str, name: str, content: str) -> str:
    """Format a tool result message for injection into the prompt."""
    return f"[Tool Result for {name} (id: {tool_call_id})]\n{content}"


def render_message_content(message: ChatCompletionMessage) -> str:
    """Flatten message content (string or content blocks) into text."""
    content = message.content
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    # Use generator expression instead of list comprehension
    return "\n".join(
        part.text
        for part in content
        if isinstance(part, ChatCompletionMessageContent)
        and part.type == "text"
        and part.text is not None
    )


def collapse_messages(request: ChatCompletionRequest) -> str:
    """Collapse OpenAI chat messages into a single Gemini prompt efficiently.

    Uses a single-pass approach with minimal intermediate allocations.
    """
    # Pre-allocate list with estimated size to reduce reallocations
    parts: list[str] = []
    system_section: list[str] = []

    for message in request.messages:
        # Handle tool result messages
        if message.role == "tool":
            rendered = render_message_content(message)
            tool_result = format_tool_result_for_prompt(
                message.tool_call_id or "unknown",
                message.name or "unknown",
                rendered,
            )
            parts.append(tool_result)
            continue

        # Handle assistant messages with tool calls (echo them for context)
        if message.role == "assistant" and message.tool_calls:
            # Build tool calls summary directly without intermediate list
            tool_names = ", ".join(
                f"Called {tc.function.name}(id={tc.id})" for tc in message.tool_calls
            )
            parts.append(f"ASSISTANT: [Tool calls: {tool_names}]")
            continue

        rendered = render_message_content(message)
        if message.role == "system":
            system_section.append(rendered)
            continue

        # Build message line directly
        prefix = "USER" if message.role == "user" else message.role.upper()
        parts.append(f"{prefix}: {rendered}")

    # Build final prompt with minimal joins
    if system_section:
        # Join system prompts and add to beginning
        base_prompt = "\n".join(system_section) + "\n\n" + "\n".join(parts)
    else:
        base_prompt = "\n".join(parts)

    # Inject tool definitions if present
    return inject_tools_into_prompt(base_prompt, request.tools)