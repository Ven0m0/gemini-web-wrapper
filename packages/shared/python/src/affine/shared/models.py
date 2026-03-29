from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional, Union, List


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


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class ContentPart:
    type: str  # "text", "image", "tool_call", "tool_result"
    text: Optional[str] = None
    image_url: Optional[str] = None
    image_data: Optional[bytes] = None
    image_media_type: Optional[str] = None
    tool_call: Optional[ToolCall] = None
    tool_call_id: Optional[str] = None
    is_error: bool = False


@dataclass
class Message:
    role: MessageRole
    content: Union[str, List[ContentPart]]

    def get_text(self) -> str:
        if isinstance(self.content, str):
            return self.content
        texts = [p.text for p in self.content if p.text]
        return "\n".join(texts)


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


@dataclass
class ChatStreamChunk:
    id: str
    choices: List[dict[str, Any]]
    created: int
    model: str
    object: str = "chat.completion.chunk"
    usage: Optional[Usage] = None
