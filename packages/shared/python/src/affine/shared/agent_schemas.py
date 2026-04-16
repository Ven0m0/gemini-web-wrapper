from typing import Any, Literal

from pydantic import BaseModel, Field

from affine.shared.openai_schemas import ChatMessage


class AgentRequest(BaseModel):
    """Request body for agent streaming endpoint."""

    model: str = Field(..., description="Model ID to use")
    messages: list[ChatMessage] = Field(..., description="Conversation history")
    system_prompt: str | None = Field(
        None, description="Optional system prompt override"
    )
    tools_enabled: bool = Field(True, description="Whether to enable coding tools")
    max_steps: int = Field(50, description="Maximum agent loop steps")
    x_provider: str | None = Field(None, description="Provider override")
    x_provider_api_key: str | None = Field(None)
    x_provider_base_url: str | None = Field(None)


class ToolCallEvent(BaseModel):
    """SSE event for tool call."""

    type: Literal["tool_call"] = "tool_call"
    tool_id: str
    tool_name: str
    arguments: dict[str, Any]


class ToolResultEvent(BaseModel):
    """SSE event for tool result."""

    type: Literal["tool_result"] = "tool_result"
    tool_id: str
    tool_name: str
    result: str


class TextDeltaEvent(BaseModel):
    """SSE event for text streaming delta."""

    type: Literal["text_delta"] = "text_delta"
    text: str


class ThinkingDeltaEvent(BaseModel):
    """SSE event for thinking/reasoning delta."""

    type: Literal["thinking_delta"] = "thinking_delta"
    thinking: str


class DoneEvent(BaseModel):
    """SSE event for stream completion."""

    type: Literal["done"] = "done"


class ErrorEvent(BaseModel):
    """SSE event for errors."""

    type: Literal["error"] = "error"
    error: str
    details: str | None = None


AgentEvent = (
    ToolCallEvent
    | ToolResultEvent
    | TextDeltaEvent
    | ThinkingDeltaEvent
    | DoneEvent
    | ErrorEvent
)
