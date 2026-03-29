from typing import Optional, List, Union
from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: Union[str, List[dict]]


class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    stream: Optional[bool] = False
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None


class ChatChoice(BaseModel):
    index: int
    message: Optional[dict] = None
    delta: Optional[dict] = None
    finish_reason: Optional[str] = None


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatChoice]
    usage: Optional[dict] = None


class ChatCompletionChunk(BaseModel):
    id: str
    object: str = "chat.completion.chunk"
    created: int
    model: str
    choices: List[ChatChoice]
