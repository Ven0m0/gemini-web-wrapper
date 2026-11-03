import logging
import secrets
import uuid
from datetime import datetime
from json import JSONDecodeError
from typing import Any

import httpx
import orjson
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from affine.api.local_index import router as local_index_router
from affine.api.repo_index import router as repo_index_router
from affine.config.settings import Settings, get_settings
from affine.llm_core.factory import ProviderFactory
from affine.llm_core.interfaces import LLMProvider
from affine.shared.agent_schemas import (
    AgentRequest,
    DoneEvent,
    ErrorEvent,
    TextDeltaEvent,
)
from affine.shared.models import TextMessage
from affine.shared.openai_schemas import (
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatCompletionResponse,
)

app = FastAPI(title="Affine AI Workstation API")
_startup_settings = get_settings()
logger = logging.getLogger(__name__)

_MODELS = [
    ("gemini-3.1-pro-preview", "google"),
    ("gemini-3-flash-preview", "google"),
    ("gemini-3.1-flash-lite-preview", "google"),
    ("claude-sonnet-4.6", "copilot"),
    ("claude-opus-4.6", "copilot"),
    ("gemini-3.1-pro", "copilot"),
    ("claude-sonnet-4-6", "anthropic"),
    ("claude-opus-4-6", "anthropic"),
    ("claude-haiku-4-5", "anthropic"),
    ("opencode/glm-5.1", "opencode"),
    ("opencode/kimi-k2.5", "opencode"),
    ("opencode/big-pickle", "opencode"),
    ("kilo-auto/frontier", "kilo"),
    ("kilo-auto/balanced", "kilo"),
    ("kilo-auto/free", "kilo"),
]

MODEL_CATALOG = [
    {"id": model_id, "object": "model", "created": 1677610602, "owned_by": owner}
    for model_id, owner in _MODELS
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_startup_settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

security = HTTPBearer(auto_error=False)


def verify_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    settings: Settings = Depends(get_settings),
):
    if not settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server API key is not configured",
        )
    if not credentials or not secrets.compare_digest(
        credentials.credentials, settings.api_key
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials


app.include_router(repo_index_router, dependencies=[Depends(verify_api_key)])
app.include_router(local_index_router, dependencies=[Depends(verify_api_key)])


def _extract_non_empty_text(value: object) -> str | None:
    if isinstance(value, str):
        normalized = value.strip()
        if normalized:
            return normalized
    return None


def _upstream_error_detail(exc: httpx.HTTPStatusError) -> str:
    response = exc.response
    try:
        data = response.json()
    except JSONDecodeError, orjson.JSONDecodeError:
        return _extract_non_empty_text(response.text) or (
            f"Upstream provider returned {response.status_code}"
        )

    if not isinstance(data, dict):
        return f"Upstream provider returned {response.status_code}"

    error = data.get("error")
    candidates = [
        error.get("message") if isinstance(error, dict) else None,
        data.get("detail"),
        data.get("message"),
    ]
    for candidate in candidates:
        detail = _extract_non_empty_text(candidate)
        if detail:
            return detail

    return f"Upstream provider returned {response.status_code}"


def _build_provider(
    x_provider: str | None,
    api_key: str | None,
    base_url: str | None,
    model: str,
    settings: Settings,
    fallback_model: str | None = None,
) -> LLMProvider:
    """Return an LLMProvider for a request.

    A valid provider override takes precedence over the server-configured
    provider and keys. Otherwise fall back to the server environment
    configuration, using the server model name, then fallback_model, then the
    provider default.
    """
    if x_provider:
        provider_kwargs: dict[str, Any] = {"model": model}
        if api_key:
            provider_kwargs["api_key"] = api_key
        if base_url:
            provider_kwargs["base_url"] = base_url

        if ProviderFactory.is_registered(x_provider):
            if api_key:
                return ProviderFactory.create(x_provider, **provider_kwargs)
            # Without a user-supplied key the request falls back to the
            # server-configured provider.
        elif base_url:
            return ProviderFactory.create(x_provider, **provider_kwargs)
        elif api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Custom providers require x_provider_base_url",
            )

    # Server-configured fallback.
    server_provider_kwargs: dict[str, Any] = {
        "api_key": settings.provider_api_key(),
        "model": settings.model_name
        or fallback_model
        or settings.provider_default_model(),
    }
    provider_base_url = settings.provider_base_url()
    if provider_base_url:
        server_provider_kwargs["base_url"] = provider_base_url
    return ProviderFactory.create(settings.model_provider, **server_provider_kwargs)


def _sse(event: TextDeltaEvent | DoneEvent | ErrorEvent) -> str:
    return f"data: {event.model_dump_json(exclude_none=True)}\n\n"


@app.post("/v1/agent/chat", dependencies=[Depends(verify_api_key)])
async def agent_chat(
    request: AgentRequest,
    settings: Settings = Depends(get_settings),
):
    """Stream agent responses with tool calls via SSE."""
    provider = _build_provider(
        request.x_provider,
        request.x_provider_api_key,
        request.x_provider_base_url,
        request.model,
        settings,
        # request.model belongs to the requested provider, so it is only a valid
        # fallback when that provider is the server's own.
        fallback_model=(
            request.model
            if not request.x_provider or request.x_provider == settings.model_provider
            else None
        ),
    )

    system_prompt = request.system_prompt
    history: list[TextMessage] = []
    user_message = ""

    for msg in request.messages:
        if msg.role == "system":
            system_prompt = (
                msg.content if isinstance(msg.content, str) else system_prompt
            )
        elif msg.role == "user":
            user_message = (
                msg.content if isinstance(msg.content, str) else str(msg.content)
            )
        else:
            history.append(
                {
                    "role": msg.role,
                    "content": msg.content
                    if isinstance(msg.content, str)
                    else str(msg.content),
                }
            )

    async def event_generator():
        try:
            async for chunk in provider.stream(
                user_message, system=system_prompt, history=history
            ):
                yield _sse(TextDeltaEvent(text=chunk))

            yield _sse(DoneEvent())
        except Exception as e:  # noqa: BLE001 - surface any provider failure as an SSE error event
            logger.error(f"Agent stream failed: {e}")
            yield _sse(ErrorEvent(error="An internal error has occurred."))
        finally:
            await provider.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
    provider = _build_provider(
        request.x_provider,
        request.x_provider_api_key,
        request.x_provider_base_url,
        request.model,
        settings,
    )
    model_name = request.model
    request_id = f"chatcmpl-{uuid.uuid4().hex}"
    created = int(datetime.now().timestamp())

    # Extract prompt and history
    prompt: Any = ""
    history: list[Any] = []
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
            try:
                async for chunk in provider.stream(
                    prompt, system=system, history=history
                ):
                    data = ChatCompletionChunk(
                        id=request_id,
                        created=created,
                        model=model_name,
                        choices=[
                            {
                                "index": 0,
                                "delta": {"content": chunk},
                                "finish_reason": None,
                            }
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
            finally:
                await provider.aclose()

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    upstream_error: httpx.HTTPStatusError | None = None
    try:
        content = await provider.generate(prompt, system=system, history=history)
    except httpx.HTTPStatusError as exc:
        upstream_error = exc
        content = ""
    finally:
        await provider.aclose()

    if upstream_error is not None:
        raise HTTPException(
            status_code=upstream_error.response.status_code,
            detail=_upstream_error_detail(upstream_error),
        ) from upstream_error
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
