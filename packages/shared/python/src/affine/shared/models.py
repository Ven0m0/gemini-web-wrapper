from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Any, TypedDict


class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class FinishReason(str, Enum):
    STOP = "stop"
    LENGTH = "length"
    TOOL_CALL = "tool_call"
    CONTENT_FILTER = "content_filter"
    ERROR = "error"


class TextMessage(TypedDict):
    role: MessageRole | str
    content: str


@dataclass(slots=True)
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass(slots=True)
class ContentPart:
    type: str  # "text", "image", "tool_call", "tool_result"
    text: str | None = None
    image_url: str | None = None
    image_data: bytes | None = None
    image_media_type: str | None = None
    tool_call: ToolCall | None = None
    tool_call_id: str | None = None
    is_error: bool = False


@dataclass(slots=True)
class Message:
    role: MessageRole
    content: str | list[ContentPart]

    def get_text(self) -> str:
        if isinstance(self.content, str):
            return self.content
        texts = [p.text for p in self.content if p.text]
        return "\n".join(texts)


@dataclass(slots=True)
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


@dataclass(slots=True)
class ChatStreamChunk:
    id: str
    choices: list[dict[str, Any]]
    created: int
    model: str
    object: str = "chat.completion.chunk"
    usage: Usage | None = None
