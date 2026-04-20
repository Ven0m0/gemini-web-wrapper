import json
import secrets
import uuid
from datetime import datetime
from json import JSONDecodeError
from typing import Any

import httpx
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
from affine.shared.agent_schemas import AgentRequest
from affine.api.repo_index import router as repo_index_router
from affine.api.local_index import router as local_index_router

app = FastAPI(title="Affine AI Workstation API")
settings = get_settings()

MODEL_CATALOG = [
    {
        "id": "gemini-3.1-pro-preview",
        "object": "model",
        "created": 1677610602,
        "owned_by": "google",
    },
    {
        "id": "gemini-3-flash-preview",
        "object": "model",
        "created": 1677610602,
        "owned_by": "google",
    },
    {
        "id": "gemini-3.1-flash-lite-preview",
        "object": "model",
        "created": 1677610602,
        "owned_by": "google",
    },
    {
        "id": "claude-sonnet-4.6",
        "object": "model",
        "created": 1677610602,
        "owned_by": "copilot",
    },
    {
        "id": "claude-opus-4.6",
        "object": "model",
        "created": 1677610602,
        "owned_by": "copilot",
    },
    {
        "id": "gemini-3.1-pro",
        "object": "model",
        "created": 1677610602,
        "owned_by": "copilot",
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
        "id": "opencode/glm-5.1",
        "object": "model",
        "created": 1677610602,
        "owned_by": "opencode",
    },
    {
        "id": "opencode/kimi-k2.5",
        "object": "model",
        "created": 1677610602,
        "owned_by": "opencode",
    },
    {
        "id": "opencode/big-pickle",
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
    except JSONDecodeError:
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


def _build_provider_from_agent_request(
    request: "AgentRequest", settings: Settings
) -> LLMProvider:
    """Build LLMProvider from agent request with overrides."""
    if request.x_provider:
        kwargs: dict[str, Any] = {"model": request.model}
        if request.x_provider_api_key:
            kwargs["api_key"] = request.x_provider_api_key
        if request.x_provider_base_url:
            kwargs["base_url"] = request.x_provider_base_url
        if ProviderFactory.is_registered(request.x_provider):
            return ProviderFactory.create(request.x_provider, **kwargs)
        elif request.x_provider_base_url:
            return ProviderFactory.create(request.x_provider, **kwargs)

    kwargs = {
        "api_key": settings.provider_api_key(),
        "model": settings.model_name or request.model,
    }
    base_url = settings.provider_base_url()
    if base_url:
        kwargs["base_url"] = base_url
    return ProviderFactory.create(settings.model_provider, **kwargs)


@app.post("/v1/agent/chat", dependencies=[Depends(verify_api_key)])
async def agent_chat(
    request: AgentRequest,
    settings: Settings = Depends(get_settings),
):
    """Stream agent responses with tool calls via SSE."""
    provider = _build_provider_from_agent_request(request, settings)

    system_prompt = request.system_prompt
    history = []
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
                event_data = {"type": "text_delta", "text": chunk}
                yield f"data: {json.dumps(event_data)}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            print(f"Agent stream failed: {e}", flush=True)
            error_event = {
                "type": "error",
                "error": "An internal error has occurred.",
            }
            yield f"data: {json.dumps(error_event)}\n\n"
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
