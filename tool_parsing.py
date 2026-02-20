"""Tool call parsing and extraction utilities.

This module contains functions for extracting, parsing, and processing
tool calls from LLM responses using robust JSON parsing techniques.
"""

from __future__ import annotations

import json
import logging
import re

import json_repair
import orjson

from openai_schemas import (
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
    return orjson.dumps(tools_data, option=orjson.OPT_INDENT_2).decode()


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

    # Early exit for very large responses to prevent performance issues
    max_text_length = 50000  # 50KB limit
    if len(text) > max_text_length:
        # For large texts, only search in the middle section around tool_calls
        tool_calls_pos = text.find('"tool_calls"')
        if tool_calls_pos >= 0:
            # Extract window around tool_calls (5KB before and after)
            window_size = 5000
            start_window = max(0, tool_calls_pos - window_size)
            end_window = min(len(text), tool_calls_pos + window_size)
            text = text[start_window:end_window]

    # Use JSONDecoder to parse JSON objects
    decoder = json.JSONDecoder()

    # Find position of "tool_calls" and search backward for opening brace
    tool_calls_pos = text.find('"tool_calls"')
    if tool_calls_pos < 0:
        return None

    # Look backward for the opening brace of the object containing tool_calls
    start_pos = text.rfind("{", 0, tool_calls_pos)
    if start_pos >= 0:
        try:
            obj, end_idx = decoder.raw_decode(text, start_pos)
            if "tool_calls" in obj:
                return text[start_pos : start_pos + end_idx]
        except json.JSONDecodeError:
            # Try repairing the malformed JSON fragment
            repaired = _repair_json_fragment(text[start_pos:])
            if repaired is not None:
                return repaired

    # Fallback: try limited braces if backward search fails (rare edge case)
    # Limit attempts to prevent O(n²) behavior on pathological inputs
    max_fallback_attempts = 10
    attempts = 0
    start = 0
    while start < len(text) and attempts < max_fallback_attempts:
        brace_idx = text.find("{", start)
        if brace_idx < 0:
            break

        try:
            obj, end_idx = decoder.raw_decode(text, brace_idx)
            if "tool_calls" in obj:
                return text[brace_idx : brace_idx + end_idx]
            start = brace_idx + 1
            attempts += 1
        except json.JSONDecodeError:
            # Try repairing the malformed JSON fragment
            repaired = _repair_json_fragment(text[brace_idx:])
            if repaired is not None:
                return repaired
            start = brace_idx + 1
            attempts += 1

    return None


def _repair_json_fragment(fragment: str) -> str | None:
    """Attempt to repair a malformed JSON fragment containing tool_calls.

    Uses json_repair to fix common LLM JSON errors (missing quotes,
    trailing commas, unescaped characters, etc.).

    Args:
        fragment: A text fragment starting at a ``{`` that may contain
            malformed JSON with ``tool_calls``.

    Returns:
        The repaired JSON string if successful and it contains
        ``tool_calls``, otherwise None.
    """
    try:
        repaired = json_repair.repair_json(fragment, return_objects=False)
        if not isinstance(repaired, str):
            return None
        obj = orjson.loads(repaired)
        if isinstance(obj, dict) and "tool_calls" in obj:
            return repaired
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
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
        # Use json_repair.loads as a drop-in replacement for json.loads
        # to handle malformed JSON from LLM output (missing quotes,
        # trailing commas, unescaped characters, etc.)
        data = json_repair.loads(json_str)

        if not isinstance(data, dict) or "tool_calls" not in data:
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

    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
        logger.debug("Failed to parse tool calls: %s", e)
        return [], text


def _parse_tool_calls_data(data: dict) -> list[ToolCall]:
    """Parse tool_calls from a decoded JSON dict."""
    tool_calls = []

    from uuid import uuid4

    for tc in data.get("tool_calls", []):
        # Handle arguments that might be dict or string
        args = tc.get("function", {}).get("arguments", "{}")
        if isinstance(args, dict):
            args = orjson.dumps(args).decode()

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
