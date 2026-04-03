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

    If the request carries ``x_provider`` + ``x_provider_api_key`` those take
    precedence over the server-configured provider and keys.  Otherwise fall
    back to the server environment configuration.
    """
    if request.x_provider and request.x_provider_api_key:
        # User-supplied provider: honour the requested model name as well.
        return ProviderFactory.create(
            request.x_provider,
            api_key=request.x_provider_api_key,
            model=request.model,
        )

    # Server-configured fallback.
    provider_kwargs: dict[str, Any] = {"api_key": settings.provider_api_key()}
    if settings.model_name is not None:
        provider_kwargs["model"] = settings.model_name
    return ProviderFactory.create(settings.model_provider, **provider_kwargs)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/v1/models", dependencies=[Depends(verify_api_key)])
async def list_models():
    return {
        "data": [
            {
                "id": "gemini-2.0-flash-exp",
                "object": "model",
                "created": 1677610602,
                "owned_by": "google",
            },
            {
                "id": "gemini-1.5-pro",
                "object": "model",
                "created": 1677610602,
                "owned_by": "google",
            },
            {
                "id": "claude-3-5-sonnet-20241022",
                "object": "model",
                "created": 1677610602,
                "owned_by": "anthropic",
            },
            {
                "id": "claude-3-haiku-20240307",
                "object": "model",
                "created": 1677610602,
                "owned_by": "anthropic",
            },
        ]
    }


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
