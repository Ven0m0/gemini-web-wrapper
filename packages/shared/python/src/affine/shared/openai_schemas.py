from typing import Any

from pydantic import BaseModel

from affine.shared.models import FinishReason, MessageRole


class ChatMessage(BaseModel):
    role: MessageRole
    content: str | list[dict[str, Any]]


class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    stream: bool = False
    max_tokens: int | None = None
    temperature: float | None = None


class ChatResponseMessage(BaseModel):
    role: MessageRole
    content: str


class ChatDelta(BaseModel):
    role: MessageRole | None = None
    content: str | None = None


class ChatUsage(BaseModel):
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


class ChatChoice(BaseModel):
    index: int
    message: ChatResponseMessage | None = None
    delta: ChatDelta | None = None
    finish_reason: FinishReason | None = None


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[ChatChoice]
    usage: ChatUsage | None = None


class ChatCompletionChunk(BaseModel):
    id: str
    object: str = "chat.completion.chunk"
    created: int
    model: str
    choices: list[ChatChoice]
