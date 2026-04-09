import secrets
import uuid
from datetime import datetime
from typing import Any

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from affine.config.settings import Settings, get_settings
from affine.llm_core.factory import ProviderFactory
from affine.llm_core.interfaces import LLMProvider
from affine.shared.openai_schemas import (
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatCompletionResponse,
)

app = FastAPI(title="Affine AI Workstation API")
settings = get_settings()

MODEL_CATALOG = [
    {
        "id": "gemini-2.5-flash",
        "object": "model",
        "created": 1677610602,
        "owned_by": "google",
    },
    {
        "id": "gemini-2.5-pro",
        "object": "model",
        "created": 1677610602,
        "owned_by": "google",
    },
    {
        "id": "gemini-2.5-flash-lite",
        "object": "model",
        "created": 1677610602,
        "owned_by": "google",
    },
    {
        "id": "claude-sonnet-4-6",
        "object": "model",
        "created": 1677610602,
        "owned_by": "anthropic",
    },
    {
        "id": "claude-opus-4-6",
        "object": "model",
        "created": 1677610602,
        "owned_by": "anthropic",
    },
    {
        "id": "claude-haiku-4-5",
        "object": "model",
        "created": 1677610602,
        "owned_by": "anthropic",
    },
    {
        "id": "opencode/gpt-5.4",
        "object": "model",
        "created": 1677610602,
        "owned_by": "opencode",
    },
    {
        "id": "opencode/claude-opus-4-6",
        "object": "model",
        "created": 1677610602,
        "owned_by": "opencode",
    },
    {
        "id": "opencode/gemini-3.1-pro",
        "object": "model",
        "created": 1677610602,
        "owned_by": "opencode",
    },
    {
        "id": "kilo-auto/frontier",
        "object": "model",
        "created": 1677610602,
        "owned_by": "kilo",
    },
    {
        "id": "kilo-auto/balanced",
        "object": "model",
        "created": 1677610602,
        "owned_by": "kilo",
    },
    {
        "id": "kilo-auto/free",
        "object": "model",
        "created": 1677610602,
        "owned_by": "kilo",
    },
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)


def verify_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    settings: Settings = Depends(get_settings),
):
    # If no server API key is configured operate in open/public mode so that
    # users can authenticate only via their own provider keys in the request body.
    # credentials may be None here (HTTPBearer auto_error=False) which is fine —
    # the endpoint does not use the credentials object directly.
    if not settings.api_key:
        return credentials
    if not credentials or not secrets.compare_digest(
        credentials.credentials, settings.api_key
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials


def _build_provider(request: ChatCompletionRequest, settings: Settings) -> LLMProvider:
    """Return an LLMProvider for this request.

    If the request carries a valid provider override those settings take
    precedence over the server-configured provider and keys. Otherwise fall
    back to the server environment configuration.
    """
    if request.x_provider:
        provider_kwargs: dict[str, Any] = {"model": request.model}
        if request.x_provider_api_key:
            provider_kwargs["api_key"] = request.x_provider_api_key
        if request.x_provider_base_url:
            provider_kwargs["base_url"] = request.x_provider_base_url

        if ProviderFactory.is_registered(request.x_provider):
            if request.x_provider_api_key:
                return ProviderFactory.create(request.x_provider, **provider_kwargs)
            # Preserve the existing built-in behavior: without a user-supplied
            # key the request falls back to the server-configured provider.
        elif request.x_provider_base_url:
            return ProviderFactory.create(request.x_provider, **provider_kwargs)
        elif request.x_provider_api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Custom providers require x_provider_base_url",
            )

    # Server-configured fallback.
    server_provider_kwargs: dict[str, Any] = {
        "api_key": settings.provider_api_key(),
        "model": settings.model_name or settings.provider_default_model(),
    }
    provider_base_url = settings.provider_base_url()
    if provider_base_url:
        server_provider_kwargs["base_url"] = provider_base_url
    return ProviderFactory.create(settings.model_provider, **server_provider_kwargs)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/v1/models", dependencies=[Depends(verify_api_key)])
async def list_models():
    return {"data": MODEL_CATALOG}


@app.post("/v1/chat/completions", dependencies=[Depends(verify_api_key)])
async def chat_completions(
    request: ChatCompletionRequest,
    settings: Settings = Depends(get_settings),
):
    provider = _build_provider(request, settings)
    model_name = request.model
    request_id = f"chatcmpl-{uuid.uuid4().hex}"
    created = int(datetime.now().timestamp())

    # Extract prompt and history
    prompt = ""
    history = []
    system = None

    for msg in request.messages:
        if msg.role == "system":
            system = msg.content
        else:
            history.append({"role": msg.role, "content": msg.content})

    if history:
        last_msg = history.pop()
        prompt = last_msg["content"]

    if request.stream:

        async def event_generator():
            async for chunk in provider.stream(prompt, system=system, history=history):
                data = ChatCompletionChunk(
                    id=request_id,
                    created=created,
                    model=model_name,
                    choices=[
                        {"index": 0, "delta": {"content": chunk}, "finish_reason": None}
                    ],
                )
                yield f"data: {data.model_dump_json()}\n\n"

            final_chunk = ChatCompletionChunk(
                id=request_id,
                created=created,
                model=model_name,
                choices=[{"index": 0, "delta": {}, "finish_reason": "stop"}],
            )
            yield f"data: {final_chunk.model_dump_json()}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    content = await provider.generate(prompt, system=system, history=history)
    return ChatCompletionResponse(
        id=request_id,
        created=created,
        model=model_name,
        choices=[
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    )
