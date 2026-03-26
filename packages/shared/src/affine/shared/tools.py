"""Tool-call schemas for function calling capability."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class FunctionCall(BaseModel):
    """A function call extracted from an LLM response."""

    name: str
    arguments: str


class ToolCall(BaseModel):
    """A tool call with function details."""

    id: str
    type: Literal["function"] = "function"
    function: FunctionCall


class ToolParameterProperty(BaseModel):
    """Schema for a single parameter property in a tool definition."""

    type: str
    description: str | None = None
    enum: list[str] | None = None


class ToolParameters(BaseModel):
    """The parameters schema for a tool definition."""

    type: Literal["object"] = "object"
    properties: dict[str, ToolParameterProperty] = Field(default_factory=dict)
    required: list[str] = Field(default_factory=list)


class ToolDefinition(BaseModel):
    """A tool/function definition for LLM tool use."""

    name: str
    description: str
    parameters: ToolParameters


class ToolChoice(BaseModel):
    """Force a specific tool to be called."""

    type: Literal["function"] = "function"
    name: str


class ToolCallPreference(BaseModel):
    """Controls tool calling behavior."""

    parallel_calls: bool = True
    tool_choice: ToolChoice | None = None


__all__ = [
    "FunctionCall",
    "ToolCall",
    "ToolParameterProperty",
    "ToolParameters",
    "ToolDefinition",
    "ToolChoice",
    "ToolCallPreference",
]
