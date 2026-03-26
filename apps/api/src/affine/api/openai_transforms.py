#!/usr/bin/env python3
"""Compatibility re-exports for openai_transforms.

The implementation has been split into focused modules:
- tool_parsing: Tool call extraction and parsing
- message_transforms: Message format conversions and tool result formatting
- response_builder: Response construction utilities
"""

from __future__ import annotations

from message_transforms import (
    collapse_messages,
    format_tool_result_for_prompt,
    render_message_content,
)
from response_builder import to_chat_completion_response
from tool_parsing import (
    format_tools_for_prompt,
    inject_tools_into_prompt,
    parse_tool_calls,
)

__all__ = [
    "collapse_messages",
    "format_tool_result_for_prompt",
    "format_tools_for_prompt",
    "inject_tools_into_prompt",
    "parse_tool_calls",
    "render_message_content",
    "to_chat_completion_response",
]
