from typing import Any

from pydantic import BaseModel, model_validator

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
    # Optional request-level provider override. Built-in providers use the
    # request API key when supplied; custom providers also require a base URL.
    x_provider: str | None = None
    x_provider_api_key: str | None = None
    x_provider_base_url: str | None = None

    @model_validator(mode="after")
    def validate_provider_override(self) -> "ChatCompletionRequest":
        if self.x_provider_base_url and not self.x_provider:
            raise ValueError("x_provider_base_url requires x_provider")
        return self


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
