#!/usr/bin/env python3
"""Utilities for translating between OpenAI-style payloads and Gemini outputs.

This module has been refactored into focused modules for better maintainability:
- tool_parsing: Tool call extraction and parsing
- message_transforms: Message format conversions  
- response_builder: Response construction utilities

This file now serves as a compatibility layer and convenience imports.
"""

from __future__ import annotations

# Re-export main functions for backward compatibility
from tool_parsing import (
    format_tool_result_for_prompt,
    inject_tools_into_prompt,
    parse_tool_calls,
    format_tools_for_prompt,
)
from message_transforms import (
    collapse_messages,
    render_message_content,
)
from response_builder import to_chat_completion_response

# For backward compatibility, also make these available from the main module
__all__ = [
    "format_tools_for_prompt",
    "inject_tools_into_prompt", 
    "format_tool_result_for_prompt",
    "render_message_content",
    "collapse_messages", 
    "parse_tool_calls",
    "to_chat_completion_response",
]