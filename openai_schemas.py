#!/usr/bin/env python3
"""Minimal OpenAI-compatible chat completion models."""
from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


# -----------------------------------------------------------------------------
# Tool / Function Calling Types
# -----------------------------------------------------------------------------
class FunctionDefinition(BaseModel):
    """OpenAI function definition schema."""

    name: str
    description: str | None = None
    parameters: dict[str, Any] | None = None


class ToolDefinition(BaseModel):
    """OpenAI tool definition (wraps function)."""

    type: Literal["function"] = "function"
    function: FunctionDefinition


class FunctionCall(BaseModel):
    """Function call details within a tool_call."""

    name: str
    arguments: str  # JSON string of arguments


class ToolCall(BaseModel):
    """A tool call returned by the model."""

    id: str
    type: Literal["function"] = "function"
    function: FunctionCall


# -----------------------------------------------------------------------------
# Message Types
# -----------------------------------------------------------------------------
class ChatCompletionMessageContent(BaseModel):
    """Content block - can be text, image_url, etc."""

    type: str = "text"
    text: str | None = None
    # Allow image_url and other content types (we'll ignore them for now)
    image_url: dict[str, Any] | None = None

    model_config = {"extra": "allow"}  # Allow unknown fields


class ChatCompletionMessage(BaseModel):
    """OpenAI chat message format."""

    role: Literal["system", "user", "assistant", "tool"]
    content: str | list[ChatCompletionMessageContent] | list[dict[str, Any]] | None = None
    tool_calls: list[ToolCall] | None = None
    tool_call_id: str | None = None  # For tool role messages
    name: str | None = None  # Function name for tool responses

    model_config = {"extra": "allow"}  # Allow unknown fields like refusal, etc.

    @model_validator(mode="after")
    def validate_tool_message(self) -> "ChatCompletionMessage":
        """Validate tool messages have required fields."""
        if self.role == "tool" and not self.tool_call_id:
            raise ValueError("tool messages must include tool_call_id")
        return self


# -----------------------------------------------------------------------------
# Request / Response
# -----------------------------------------------------------------------------
class ChatCompletionRequest(BaseModel):
    """OpenAI chat completion request format."""

    model: str | None = None
    messages: list[ChatCompletionMessage]
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    max_tokens: int | None = Field(default=None, gt=0)
    stream: bool = False
    tools: list[ToolDefinition] | None = None
    tool_choice: Literal["none", "auto", "required"] | dict[str, Any] | None = "auto"
    # Common fields from OpenAI API that we accept but ignore
    n: int | None = None
    stop: str | list[str] | None = None
    presence_penalty: float | None = None
    frequency_penalty: float | None = None
    logit_bias: dict[str, float] | None = None
    user: str | None = None
    seed: int | None = None
    response_format: dict[str, Any] | None = None
    stream_options: dict[str, Any] | None = None

    model_config = {"extra": "allow"}  # Allow unknown fields

    @model_validator(mode="after")
    def validate_capabilities(self) -> "ChatCompletionRequest":
        """Validate request has required fields."""
        # Note: stream=True is handled in the endpoint before validation
        if not self.messages:
            raise ValueError("messages must contain at least one item")
        return self


class ChatCompletionResponseUsage(BaseModel):
    """Token usage information."""

    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


class ChatCompletionResponseChoice(BaseModel):
    """A completion choice."""

    index: int
    message: ChatCompletionMessage
    finish_reason: Literal["stop", "length", "content_filter", "tool_calls"] = "stop"


class ChatCompletionResponse(BaseModel):
    """OpenAI chat completion response format."""

    id: str
    object: Literal["chat.completion"] = "chat.completion"
    created: int
    model: str
    choices: list[ChatCompletionResponseChoice]
    usage: ChatCompletionResponseUsage | None = None
    system_fingerprint: str | None = None
