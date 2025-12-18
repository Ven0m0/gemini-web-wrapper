#!/usr/bin/env python3
"""Utilities for translating between OpenAI-style payloads and Gemini outputs."""

from __future__ import annotations

import json
import logging
import re
import time
from uuid import uuid4

from gemini_webapi import ModelOutput

from openai_schemas import (
    ChatCompletionMessage,
    ChatCompletionMessageContent,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionResponseChoice,
    ChatCompletionResponseUsage,
    FunctionCall,
    ToolCall,
    ToolDefinition,
)

logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# Tool Prompt Injection
# -----------------------------------------------------------------------------
TOOL_SYSTEM_PROMPT = """You have access to the following tools. When you need to use a tool, respond with ONLY a JSON object in this exact format (no markdown, no extra text):

{{"tool_calls": [{{"id": "call_<unique_id>", "type": "function", "function": {{"name": "<tool_name>", "arguments": "<json_string_of_args>"}}}}]}}

Important:
- The "arguments" field must be a JSON string (escaped), not a raw object
- Generate a unique id like "call_abc123" for each tool call
- You can call multiple tools in one response
- If you don't need to use a tool, respond normally with text

Available tools:
{tools_json}
"""


def format_tools_for_prompt(tools: list[ToolDefinition]) -> str:
    """Format tool definitions as JSON for prompt injection."""
    tools_data = [
        {
            "type": tool.type,
            "function": {
                "name": tool.function.name,
                "description": tool.function.description,
                "parameters": tool.function.parameters,
            },
        }
        for tool in tools
    ]
    return json.dumps(tools_data, indent=2)


def inject_tools_into_prompt(prompt: str, tools: list[ToolDefinition] | None) -> str:
    """Prepend tool instructions to the prompt if tools are provided."""
    if not tools:
        return prompt

    tools_json = format_tools_for_prompt(tools)
    tool_instructions = TOOL_SYSTEM_PROMPT.format(tools_json=tools_json)
    return f"{tool_instructions}\n\n{prompt}"


# -----------------------------------------------------------------------------
# Tool Call Parsing
# -----------------------------------------------------------------------------
def _extract_json_with_tool_calls(text: str) -> str | None:
    """Find a complete JSON object containing tool_calls using JSONDecoder.

    Uses json.JSONDecoder for robust parsing. Optimized to search backward
    from "tool_calls" position to find the containing JSON object start.
    This avoids trying to parse at every brace position (O(n*m) -> O(n)).
    """
    # Early exit if tool_calls not in text
    if '"tool_calls"' not in text:
        return None

    # Use JSONDecoder to parse JSON objects
    decoder = json.JSONDecoder()

    # Find position of "tool_calls" and search backward for opening brace
    tool_calls_pos = text.find('"tool_calls"')
    if tool_calls_pos < 0:
        return None

    # Look backward for the opening brace of the object containing tool_calls
    # Start from the position before "tool_calls"
    start_pos = text.rfind("{", 0, tool_calls_pos)
    if start_pos >= 0:
        try:
            obj, end_idx = decoder.raw_decode(text, start_pos)
            if "tool_calls" in obj:
                return text[start_pos : start_pos + end_idx]
        except json.JSONDecodeError:
            pass

    # Fallback: try all braces if backward search fails (rare edge case)
    start = 0
    while start < len(text):
        brace_idx = text.find("{", start)
        if brace_idx < 0:
            break

        try:
            obj, end_idx = decoder.raw_decode(text, brace_idx)
            if "tool_calls" in obj:
                return text[brace_idx : brace_idx + end_idx]
            start = brace_idx + 1
        except json.JSONDecodeError:
            start = brace_idx + 1

    return None


def _find_tool_call_json(
    text: str,
) -> tuple[str | None, bool, tuple[int, int] | None]:
    """Locate tool_call JSON directly or inside a fenced block."""
    json_str = _extract_json_with_tool_calls(text)
    if json_str:
        return json_str, False, None

    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if not code_block_match:
        return None, False, None

    block_content = code_block_match.group(1).strip()
    if '"tool_calls"' not in block_content:
        return None, False, None

    return (
        _extract_json_with_tool_calls(block_content),
        True,
        code_block_match.span(),
    )


def parse_tool_calls(text: str) -> tuple[list[ToolCall], str]:
    """Extract tool calls from model response text.

    Returns:
        Tuple of (list of ToolCall objects, remaining text content)
    """
    if not text:
        return [], ""

    json_str, from_block, block_span = _find_tool_call_json(text)
    if not json_str:
        return [], text

    try:
        data = json.loads(json_str)

        if "tool_calls" not in data:
            return [], text

        tool_calls = _parse_tool_calls_data(data)

        if tool_calls:
            if from_block and block_span:
                remaining_text = (text[: block_span[0]] + text[block_span[1] :]).strip()
            else:
                start_pos = text.find(json_str)
                if start_pos >= 0:
                    remaining_text = (
                        text[:start_pos] + text[start_pos + len(json_str) :]
                    ).strip()
                else:
                    remaining_text = text.strip()
            return tool_calls, remaining_text

        return [], text

    except (json.JSONDecodeError, KeyError, TypeError) as e:
        # Log for debugging
        logger.debug(f"Failed to parse tool calls: {e}")
        return [], text


def _parse_tool_calls_data(data: dict) -> list[ToolCall]:
    """Parse tool_calls from a decoded JSON dict."""
    tool_calls = []

    for tc in data.get("tool_calls", []):
        # Handle arguments that might be dict or string
        args = tc.get("function", {}).get("arguments", "{}")
        if isinstance(args, dict):
            args = json.dumps(args)

        call_id = tc.get("id", f"call_{uuid4().hex[:12]}")

        tool_calls.append(
            ToolCall(
                id=call_id,
                type="function",
                function=FunctionCall(
                    name=tc.get("function", {}).get("name", ""),
                    arguments=args,
                ),
            )
        )

    return tool_calls


# -----------------------------------------------------------------------------
# Tool Result Formatting
# -----------------------------------------------------------------------------
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
    return "\n".join(
        [
            part.text
            for part in content
            if isinstance(part, ChatCompletionMessageContent)
            and part.type == "text"
            and part.text is not None
        ]
    )


def collapse_messages(request: ChatCompletionRequest) -> str:
    """Collapse OpenAI chat messages into a single Gemini prompt."""
    system_prompts: list[str] = []
    dialogue_lines: list[str] = []

    for message in request.messages:
        # Handle tool result messages
        if message.role == "tool":
            rendered = render_message_content(message)
            tool_result = format_tool_result_for_prompt(
                message.tool_call_id or "unknown",
                message.name or "unknown",
                rendered,
            )
            dialogue_lines.append(tool_result)
            continue

        # Handle assistant messages with tool calls (echo them for context)
        if message.role == "assistant" and message.tool_calls:
            tool_calls_summary = []
            for tc in message.tool_calls:
                tool_calls_summary.append(f"Called {tc.function.name}(id={tc.id})")
            dialogue_lines.append(
                f"ASSISTANT: [Tool calls: {', '.join(tool_calls_summary)}]"
            )
            continue

        rendered = render_message_content(message)
        if message.role == "system":
            system_prompts.append(rendered)
            continue
        prefix = "USER" if message.role == "user" else message.role.upper()
        dialogue_lines.append(f"{prefix}: {rendered}")

    prompt_sections: list[str] = []
    if system_prompts:
        prompt_sections.append("\n".join(system_prompts))
    prompt_sections.append("\n".join(dialogue_lines))

    base_prompt = "\n\n".join(section for section in prompt_sections if section)

    # Inject tool definitions if present
    return inject_tools_into_prompt(base_prompt, request.tools)


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
