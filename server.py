#!/usr/bin/env python3
"""FastAPI server for Gemini API with strict typing and performance.

High-performance HTTP API for chat and code assistance using Google's
Gemini model via the Genkit framework. Features: strict typing,
async/await, orjson, uvloop, and comprehensive validation.
"""

import asyncio
import json
import mimetypes
import os
import re
import sys
import time
from collections.abc import AsyncGenerator, Callable, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, Literal, cast
from uuid import uuid4

import httpx
from cachetools import TTLCache
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from cookie_manager import CookieManager
from gemini_client import GeminiClientWrapper
from github_service import GitHubConfig, GitHubService
from llm_core.factory import ProviderFactory, ProviderType
from llm_core.interfaces import LLMProvider
from openai_schemas import ChatCompletionRequest, ChatCompletionResponse
from openai_transforms import (
    collapse_messages,
    parse_tool_calls,
    to_chat_completion_response,
)
from session_manager import SessionManager
from utils import handle_generation_errors, run_in_thread


# ----- Configuration -----
class Settings(BaseSettings):
    """Application settings loaded from environment or .env file."""

    model_config = SettingsConfigDict(env_file=".env")

    google_api_key: str
    model_provider: str = "gemini"
    model_name: str | None = None
    anthropic_api_key: str | None = None

    # Model aliases for OpenAI compatibility
    model_aliases: dict[str, str] = {
        "gpt-4o-mini": "gemini-2.5-flash",
        "gpt-4o": "gemini-2.5-pro",
        "gpt-4.1-mini": "gemini-3.0-pro",
        "gemini-flash": "gemini-2.5-flash",
        "gemini-pro": "gemini-2.5-pro",
        "gemini-3-pro": "gemini-3.0-pro",
        "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
    }

    def resolve_model(self, requested: str | None) -> str:
        """Return a Gemini model name for a requested OpenAI-style name."""
        if not requested:
            return self.model_name
        if requested in self.model_aliases:
            return self.model_aliases[requested]
        return requested


# ----- State Management -----
@dataclass
class AppState:
    """Global application state for Genkit and session management resources.

    Uses dataclass to ensure proper instance attribute initialization
    and avoid mutable class attribute anti-pattern.
    """

    llm_provider: LLMProvider | None = None
    session_manager: SessionManager | None = None
    chatbot_flow: Callable[..., Any] | None = None
    settings: Settings | None = None
    # Cache for session setup with TTL to prevent unbounded growth
    # maxsize=10000 entries, ttl=3600 seconds (1 hour)
    attribution_cache: TTLCache = field(
        default_factory=lambda: TTLCache(maxsize=10000, ttl=3600)
    )
    # Cookie management for gemini-webapi
    cookie_manager: CookieManager | None = None
    gemini_client: GeminiClientWrapper | None = None


state = AppState()


# ----- Lifespan -----
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Initialize and cleanup Genkit resources on app startup/shutdown.

    This context manager handles:
    - Loading configuration from environment/settings
    - Initializing the Genkit client with Google GenAI plugin
    - Setting up the model for generation
    - Cleaning up resources on shutdown

    Args:
        app: FastAPI application instance.

    Yields:
        None: Control flow during application lifetime.

    Raises:
        SystemExit: If configuration loading fails.
    """
    try:
        state.settings = Settings()
    except (ValueError, KeyError, TypeError) as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)
    settings = state.settings

    # Initialize LLM Provider using Factory
    # Default to gemini if not specified or "google" (legacy)
    provider_type_raw = settings.model_provider
    if provider_type_raw == "google":
        provider_type_raw = "gemini"

    if provider_type_raw not in ("gemini", "anthropic", "copilot"):
        print(f"Unknown provider: {provider_type_raw}", file=sys.stderr)
        sys.exit(1)

    provider_type = cast(ProviderType, provider_type_raw)
    api_key = (
        settings.google_api_key
        if provider_type == "gemini"
        else settings.anthropic_api_key
    )
    state.llm_provider = ProviderFactory.create(
        provider_type,
        api_key=api_key,
        model_name=settings.model_name,
    )

    # Initialize lightweight session manager for user/session tracking
    state.session_manager = SessionManager()
    # Initialize cookie manager and gemini-webapi client
    state.cookie_manager = CookieManager(db_path="gemini_cookies.db")
    await state.cookie_manager.init_db()
    state.gemini_client = GeminiClientWrapper(state.cookie_manager)
    yield
    # Cleanup if necessary

    state.llm_provider = None
    state.session_manager = None
    state.settings = None
    state.cookie_manager = None
    state.gemini_client = None
    state.attribution_cache.clear()


# ----- App Initialization -----
app = FastAPI(
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
    title="Genkit Gemini Server",
    docs_url=None,  # Disable documentation to avoid schema generation issues
    redoc_url=None,  # Disable redoc to avoid schema generation issues
    openapi_url=None,  # Disable OpenAPI schema to avoid httpx.Client schema issues
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, replace "*" with your Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----- Models -----
class ChatMessage(BaseModel):
    """A single message in a chat conversation.

    Attributes:
        role: Who sent the message (system, user, or model).
        content: The message text.
    """

    role: Literal["system", "user", "model"]
    content: str = Field(..., min_length=1)


class ChatReq(BaseModel):
    """Request model for chat endpoint.

    Attributes:
        prompt: User message/question (min 1 character, max 50000 chars).
        system: Optional system message to set context/behavior.
    """

    prompt: str = Field(..., min_length=1, max_length=50000)
    system: str | None = Field(default=None, max_length=10000)


class ChatbotReq(BaseModel):
    """Request model for chatbot endpoint with history.

    Attributes:
        message: User message/question (min 1 character, max 50000 chars).
        history: Previous conversation messages (max 50 messages).
        system: Optional system instruction to customize behavior.
        user_id: Optional user identifier for memory attribution.
        session_id: Optional session identifier for memory tracking.
    """

    message: str = Field(..., min_length=1, max_length=50000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=50)
    system: str | None = Field(default=None, max_length=10000)
    user_id: str | None = Field(default=None)
    session_id: str | None = Field(default=None)


class CodeReq(BaseModel):
    """Request model for code assistance endpoint.

    Attributes:
        code: Source code to be modified/analyzed (max 100000 chars).
        instruction: Instruction describing desired changes (max 10000 chars).
    """

    code: str = Field(..., min_length=1, max_length=100000)
    instruction: str = Field(..., min_length=1, max_length=10000)


class GenResponse(BaseModel):
    """Response model for generation endpoints.

    Attributes:
        text: Generated text from the model.
    """

    text: str


# ----- Logic Helpers -----
async def run_generate(
    prompt: str,
    model: LLMProvider,
    *,
    system: str | None = None,
    history: Sequence[dict[str, str]] | None = None,
    timeout: float = 30.0,
) -> str:
    """Run model generation with a timeout.

    Args:
        prompt: User prompt.
        model: Initialized LLMProvider instance.
        system: Optional system instruction.
        history: Optional conversation history.
        timeout: Maximum time to wait for generation (default 30 seconds).

    Returns:
        Generated text.
    """
    try:
        return await asyncio.wait_for(
            model.generate(prompt, system=system, history=history),
            timeout=timeout,
        )
    except TimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Model generation timed out after {timeout}s",
        ) from e


async def _setup_session_attribution(
    session_mgr: SessionManager,
    user_id: str | None,
    session_id: str | None,
) -> None:
    """Set up session attribution for conversation tracking.

    Configures session manager with user and session identifiers.
    Uses TTL cache to avoid redundant attribution calls for same user/session
    while preventing unbounded memory growth.

    Args:
        session_mgr: Initialized SessionManager instance.
        user_id: Optional user identifier (defaults to "default_user").
        session_id: Optional session identifier for grouping interactions.
    """
    if user_id or session_id:
        # Create cache key from user_id and session_id
        # Normalize None to sentinel to prevent cache key duplication
        effective_user_id = user_id or "default_user"
        effective_session_id = session_id or "__no_session__"
        cache_key = (effective_user_id, effective_session_id)

        # Only set up attribution if not already cached
        if cache_key not in state.attribution_cache:
            session_mgr.attribution(
                entity_id=effective_user_id,
                process_id="gemini-chatbot",
            )
            if session_id:  # Only set session if explicitly provided
                session_mgr.set_session(session_id)
            # Add to cache (TTLCache expires after 1 hour)
            state.attribution_cache[cache_key] = True


# ----- Dependencies -----
def get_llm_provider() -> LLMProvider:
    """FastAPI dependency to get the initialized model.

    Returns:
        Initialized LLMProvider instance.

    Raises:
        HTTPException: 503 if provider is not initialized.
    """
    if state.llm_provider is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM Provider not initialized. Check server logs.",
        )
    return state.llm_provider


def get_session_manager() -> SessionManager:
    """FastAPI dependency to get the initialized SessionManager instance.

    Returns:
        Initialized SessionManager instance.

    Raises:
        HTTPException: 503 if SessionManager is not initialized.
    """
    if state.session_manager is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session manager not initialized. Check server logs.",
        )
    return state.session_manager


def get_cookie_manager() -> CookieManager:
    """FastAPI dependency to get the initialized CookieManager.

    Returns:
        Initialized CookieManager instance.

    Raises:
        HTTPException: 503 if CookieManager is not initialized.
    """
    if state.cookie_manager is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cookie manager not initialized.",
        )
    return state.cookie_manager


def get_gemini_client() -> GeminiClientWrapper:
    """FastAPI dependency to get the initialized GeminiClientWrapper.

    Returns:
        Initialized GeminiClientWrapper instance.

    Raises:
        HTTPException: 503 if GeminiClientWrapper is not initialized.
    """
    if state.gemini_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini client not initialized.",
        )
    return state.gemini_client


def get_settings() -> Settings:
    """FastAPI dependency to get the cached Settings instance.

    Returns:
        Cached Settings instance loaded at startup.

    Raises:
        HTTPException: 503 if Settings is not initialized.
    """
    if state.settings is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Settings not initialized.",
        )
    return state.settings


# ----- Endpoints -----
@app.post("/chat", response_model=GenResponse)
@handle_generation_errors
async def chat(
    r: ChatReq,
    model: LLMProvider = Depends(get_llm_provider),
) -> dict[str, str]:
    """Handle conversational chat requests."""
    text = await run_generate(r.prompt, model, system=r.system)
    return {"text": text}


@app.post("/code", response_model=GenResponse)
@handle_generation_errors
async def code(
    r: CodeReq,
    model: LLMProvider = Depends(get_llm_provider),
) -> dict[str, str]:
    """Handle code assistance requests."""
    prompt = "\n".join(
        [
            "You are a coding assistant.",
            "Apply the following instruction to the code.",
            "",
            "Instruction:",
            r.instruction,
            "",
            "Code:",
            r.code,
        ]
    )
    text = await run_generate(prompt, model)
    return {"text": text}


@app.get("/health")
async def health() -> dict[str, bool]:
    """Health check endpoint.

    Returns:
        Dict with 'ok: True' indicating service is running.
    """
    return {"ok": True}


@app.post("/chatbot", response_model=GenResponse)
@handle_generation_errors
async def chatbot(
    r: ChatbotReq,
    model: LLMProvider = Depends(get_llm_provider),
    session_mgr: SessionManager = Depends(get_session_manager),
) -> dict[str, str]:
    """Handle chatbot requests with conversation history."""
    await _setup_session_attribution(session_mgr, r.user_id, r.session_id)
    history_dicts = (
        [{"role": m.role, "content": m.content} for m in r.history]
        if r.history
        else None
    )
    text = await run_generate(
        r.message,
        model,
        system=r.system,
        history=history_dicts,
    )
    return {"text": text}


@app.post("/chatbot/stream")
async def chatbot_stream(
    r: ChatbotReq,
    model: LLMProvider = Depends(get_llm_provider),
    session_mgr: SessionManager = Depends(get_session_manager),
) -> StreamingResponse:
    """Handle chatbot requests with streaming responses."""

    await _setup_session_attribution(session_mgr, r.user_id, r.session_id)
    history_dicts = (
        [{"role": m.role, "content": m.content} for m in r.history]
        if r.history
        else None
    )

    async def generate_stream() -> AsyncGenerator[str]:
        try:
            async for chunk in model.stream(
                r.message,
                system=r.system,
                history=history_dicts,
            ):
                yield chunk
        except Exception as e:
            # Log detailed error server-side, but return a generic message to the client
            print(f"chatbot_stream generation error: {e}", file=sys.stderr)
            yield "Error: Generation failed"

    return StreamingResponse(generate_stream(), media_type="text/plain")


@app.post("/memory/session/new")
async def create_new_session(
    user_id: str | None = None,
    session_mgr: SessionManager = Depends(get_session_manager),
) -> dict[str, str]:
    """Create a new session for a user.

    Args:
        user_id: Optional user identifier for the session.
        session_mgr: Injected SessionManager dependency.

    Returns:
        Dict with 'status', 'message', and 'session_id'.

    Raises:
        HTTPException: 503 if session manager not initialized, 500 on failure.
    """
    try:
        session_mgr.attribution(
            entity_id=user_id or "default_user",
            process_id="gemini-chatbot",
        )
        session_id = session_mgr.new_session()
        return {
            "status": "success",
            "message": "New session created",
            "session_id": session_id,
        }
    except (RuntimeError, ValueError, AttributeError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Session creation failed: {e}",
        ) from e


class SessionQueryReq(BaseModel):
    """Request model for session query endpoint.

    Attributes:
        user_id: User identifier to query sessions for.
    """

    user_id: str = Field(..., min_length=1)


@app.post("/memory/query")
async def query_sessions(
    r: SessionQueryReq,
    session_mgr: SessionManager = Depends(get_session_manager),
) -> dict[str, Any]:
    """Query active sessions for a user.

    Returns all active (non-expired) sessions for a given user.

    Args:
        r: SessionQueryReq containing user_id.
        session_mgr: Injected SessionManager dependency.

    Returns:
        Dict with 'sessions' list containing session details.

    Raises:
        HTTPException: 503 if session manager not initialized, 500 on failure.
    """
    try:
        sessions = session_mgr.get_user_sessions(r.user_id)
        session_data = [
            {
                "session_id": s.session_id,
                "user_id": s.user_id,
                "process_id": s.process_id,
                "created_at": s.created_at,
                "last_accessed": s.last_accessed,
            }
            for s in sessions
        ]
        return {
            "sessions": session_data,
            "count": len(session_data),
        }
    except (RuntimeError, ValueError, AttributeError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Session query failed: {e}",
        ) from e


# ----- OpenAI-Compatible Endpoints -----
async def generate_sse_response(
    text: str,
    model: str,
    request_id: str,
    include_usage: bool = False,
) -> AsyncGenerator[str]:
    """Generate SSE chunks by splitting text into smaller pieces for streaming.

    Since Gemini doesn't provide true token-by-token streaming, we split the
    complete response into word-based chunks to provide a better UX.
    """
    created = int(time.time())
    # Split text into chunks by sentences or words for better streaming UX
    # Use sentence boundaries for more natural chunking
    # Split by sentences (periods, exclamation marks, question marks)
    sentences = re.split(r"([.!?]+\s+)", text)
    chunks = []
    current_chunk = ""

    # Combine sentence parts back and group into ~50 char chunks
    for part in sentences:
        current_chunk += part
        if (
            len(current_chunk) >= 50 or part.strip().endswith((".", "!", "?"))
        ) and current_chunk.strip():
            chunks.append(current_chunk)
            current_chunk = ""

    # Add any remaining text
    if current_chunk.strip():
        chunks.append(current_chunk)

    # If splitting failed, use words as fallback
    if not chunks or len(chunks) == 1:
        words = text.split()
        chunks = []
        current_chunk = ""
        for word in words:
            current_chunk += word + " "
            if len(current_chunk) >= 50:
                chunks.append(current_chunk.strip())
                current_chunk = ""
        if current_chunk.strip():
            chunks.append(current_chunk.strip())

    # Send first chunk with role
    if chunks:
        first_chunk = {
            "id": request_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "delta": {
                        "role": "assistant",
                        "content": chunks[0],
                    },
                    "finish_reason": None,
                }
            ],
        }
        yield f"data: {json.dumps(first_chunk)}\n\n"

        # Send remaining chunks
        for chunk_text in chunks[1:]:
            chunk_data = {
                "id": request_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [
                    {
                        "index": 0,
                        "delta": {
                            "content": chunk_text,
                        },
                        "finish_reason": None,
                    }
                ],
            }
            yield f"data: {json.dumps(chunk_data)}\n\n"
            # Small delay to simulate streaming
            await asyncio.sleep(0.01)

    # Send finish chunk
    finish_chunk = {
        "id": request_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [
            {
                "index": 0,
                "delta": {},
                "finish_reason": "stop",
            }
        ],
    }
    if include_usage:
        finish_chunk["usage"] = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }
    yield f"data: {json.dumps(finish_chunk)}\n\n"
    # Send done marker
    yield "data: [DONE]\n\n"


async def generate_sse_tool_response(
    tool_calls: list,
    model: str,
    request_id: str,
    include_usage: bool = False,
) -> AsyncGenerator[str]:
    """Generate SSE chunks for tool call responses."""
    created = int(time.time())
    # Send tool calls
    for i, tc in enumerate(tool_calls):
        chunk_data = {
            "id": request_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "delta": {
                        "role": "assistant",
                        "tool_calls": [
                            {
                                "index": i,
                                "id": tc.id,
                                "type": "function",
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": tc.function.arguments,
                                },
                            }
                        ],
                    },
                    "finish_reason": None,
                }
            ],
        }
        yield f"data: {json.dumps(chunk_data)}\n\n"
    # Send finish chunk
    finish_chunk = {
        "id": request_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [
            {
                "index": 0,
                "delta": {},
                "finish_reason": "tool_calls",
            }
        ],
    }
    if include_usage:
        finish_chunk["usage"] = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }
    yield f"data: {json.dumps(finish_chunk)}\n\n"

    yield "data: [DONE]\n\n"


@app.post("/v1/chat/completions", response_model=None)
async def openai_chat_completions(
    request: ChatCompletionRequest,
    gemini_client: GeminiClientWrapper = Depends(get_gemini_client),
    settings: Settings = Depends(get_settings),
) -> ChatCompletionResponse | StreamingResponse:
    """OpenAI-compatible chat completions endpoint.

    This endpoint accepts OpenAI-style chat completion requests and translates them
    to Gemini API calls. It supports:
    - Message history with system/user/assistant roles
    - Tool calling via prompt injection
    - Streaming responses (SSE format)
    - Model aliasing (e.g., gpt-4o-mini -> gemini-2.5-flash)

    Args:
        request: ChatCompletionRequest with messages and optional tools.
        gemini_client: Injected GeminiClientWrapper dependency.
        settings: Injected Settings dependency.

    Returns:
        ChatCompletionResponse or StreamingResponse if streaming is enabled.

    Raises:
        HTTPException: 503 if client not initialized, 502 if generation fails.
    """
    # Initialize client if needed (auto-import cookies)
    if not await gemini_client.ensure_initialized():
        success = await gemini_client.init_auto()
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Failed to auto-initialize. Please login to gemini.google.com or create a profile."
                ),
            )
    # Resolve model name (handle aliases)
    model_name = settings.resolve_model(request.model)
    # Collapse messages into a single prompt
    prompt = collapse_messages(request)
    # Generate request ID
    request_id = f"chatcmpl-{uuid4().hex}"
    try:
        # Use gemini-webapi client to generate content
        if not gemini_client.client:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Gemini client not ready",
            )
        # Generate content using the client with timeout protection
        try:
            raw_response = await asyncio.wait_for(
                run_in_thread(
                    gemini_client.client.generate_content,
                    prompt,
                    model=model_name,
                ),
                timeout=30.0,
            )
        except TimeoutError as e:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Gemini generation timed out after 30s",
            ) from e
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini generation failed: {exc}",
        ) from exc
    # Parse for tool calls
    text = raw_response.text or ""
    tool_calls: list = []
    if request.tools and request.tool_choice != "none":
        tool_calls, text = parse_tool_calls(text)
    # Check if streaming is requested
    is_streaming = request.stream
    include_usage = False
    stream_options = getattr(request, "stream_options", {}) or {}
    include_usage = stream_options.get("include_usage", False)
    if is_streaming:
        # Return SSE streaming response
        if tool_calls:
            return StreamingResponse(
                generate_sse_tool_response(
                    tool_calls,
                    request.model or model_name,
                    request_id,
                    include_usage,
                ),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            )
        else:
            return StreamingResponse(
                generate_sse_response(
                    text,
                    request.model or model_name,
                    request_id,
                    include_usage,
                ),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            )
    else:
        # Return regular JSON response
        return to_chat_completion_response(raw_response, request, model_name)


# ----- Profile Management Endpoints -----
class ProfileCreateReq(BaseModel):
    """Request model for creating a profile from browser cookies.

    Attributes:
        name: Profile name/identifier.
        browser: Browser to extract cookies from.
    """

    name: str = Field(..., min_length=1)
    browser: str = Field(default="chrome")


class ProfileSwitchReq(BaseModel):
    """Request model for switching to a profile.

    Attributes:
        name: Profile name to switch to.
    """

    name: str = Field(..., min_length=1)


@app.post("/profiles/create")
async def create_profile(
    r: ProfileCreateReq,
    cookie_mgr: CookieManager = Depends(get_cookie_manager),
) -> dict[str, Any]:
    """Create a new profile by extracting cookies from browser.

    Args:
        r: ProfileCreateReq with profile name and browser type.
        cookie_mgr: Injected CookieManager dependency.

    Returns:
        Dict with status and message.

    Raises:
        HTTPException: 503 if cookie manager not initialized, 400 if creation fails.
    """
    try:
        success = await cookie_mgr.create_profile_from_browser(
            r.name,
            r.browser,  # type: ignore
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create profile '{r.name}' from {r.browser}",
            )
        return {
            "status": "success",
            "message": f"Profile '{r.name}' created from {r.browser}",
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profile creation failed: {e}",
        ) from e


@app.get("/profiles/list")
async def list_profiles(
    cookie_mgr: CookieManager = Depends(get_cookie_manager),
    gemini_client: GeminiClientWrapper = Depends(get_gemini_client),
) -> dict[str, Any]:
    """List all stored profiles.

    Args:
        cookie_mgr: Injected CookieManager dependency.
        gemini_client: Injected GeminiClientWrapper dependency.

    Returns:
        Dict with profiles list and current profile info.

    Raises:
        HTTPException: 503 if cookie manager not initialized.
    """
    profiles = await cookie_mgr.list_profiles()
    current_profile = gemini_client.get_current_profile()

    return {
        "profiles": profiles,
        "current_profile": current_profile,
        "count": len(profiles),
    }


@app.post("/profiles/switch")
async def switch_profile(
    r: ProfileSwitchReq,
    gemini_client: GeminiClientWrapper = Depends(get_gemini_client),
) -> dict[str, str]:
    """Switch to a different profile.

    Args:
        r: ProfileSwitchReq with profile name.
        gemini_client: Injected GeminiClientWrapper dependency.

    Returns:
        Dict with status and message.

    Raises:
        HTTPException: 503 if services not initialized, 400 if switch fails.
    """
    try:
        success = await gemini_client.switch_profile(r.name)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to switch to profile '{r.name}'",
            )
        return {
            "status": "success",
            "message": f"Switched to profile '{r.name}'",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profile switch failed: {e}",
        ) from e


@app.delete("/profiles/{profile_name}")
async def delete_profile(
    profile_name: str,
    cookie_mgr: CookieManager = Depends(get_cookie_manager),
) -> dict[str, str]:
    """Delete a profile and its cookies.

    Args:
        profile_name: Name of the profile to delete.
        cookie_mgr: Injected CookieManager dependency.

    Returns:
        Dict with status and message.

    Raises:
        HTTPException: 503 if cookie manager not initialized, 404 if not found.
    """
    success = await cookie_mgr.delete_profile(profile_name)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile '{profile_name}' not found",
        )
    return {
        "status": "success",
        "message": f"Profile '{profile_name}' deleted",
    }


@app.post("/profiles/{profile_name}/refresh")
async def refresh_profile(
    profile_name: str,
    cookie_mgr: CookieManager = Depends(get_cookie_manager),
) -> dict[str, str]:
    """Refresh cookies for a profile.

    Args:
        profile_name: Name of the profile to refresh.
        cookie_mgr: Injected CookieManager dependency.

    Returns:
        Dict with status and message.

    Raises:
        HTTPException: 503 if cookie manager not initialized, 400 if refresh fails.
    """
    success = await cookie_mgr.refresh_profile(profile_name)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to refresh profile '{profile_name}'",
        )
    return {
        "status": "success",
        "message": f"Profile '{profile_name}' refreshed",
    }


# ----- Gemini WebAPI Endpoints -----
class GeminiChatReq(BaseModel):
    """Request model for gemini-webapi chat endpoint.

    Attributes:
        message: User message (max 50000 chars).
        conversation_id: Optional conversation ID to continue a chat.
        profile: Optional profile to use (if not already initialized).
    """

    message: str = Field(..., min_length=1, max_length=50000)
    conversation_id: str | None = Field(default=None)
    profile: str | None = Field(default=None)


@app.post("/gemini/chat")
async def gemini_chat(
    r: GeminiChatReq,
    gemini_client: GeminiClientWrapper = Depends(get_gemini_client),
) -> dict[str, Any]:
    """Chat using gemini-webapi with cookie authentication.

    This endpoint uses the gemini-webapi library directly instead of Genkit,
    allowing for cookie-based authentication and access to web features.

    Args:
        r: GeminiChatReq with message and optional conversation ID.
        gemini_client: Injected GeminiClientWrapper dependency.

    Returns:
        Dict with response text and conversation ID.

    Raises:
        HTTPException: 503 if client not initialized, 400 if profile fails, 500 if chat fails.
    """
    # Initialize with profile if specified
    if r.profile:
        success = await gemini_client.init_with_profile(r.profile)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to initialize with profile '{r.profile}'",
            )
    # Otherwise try auto-init if not already initialized
    elif not await gemini_client.ensure_initialized():
        success = await gemini_client.init_auto()
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Failed to auto-initialize. Please login to gemini.google.com or create a profile."
                ),
            )
    try:
        response_text, conversation_id = await gemini_client.chat(
            r.message,
            r.conversation_id,
        )
        return {
            "text": response_text,
            "conversation_id": conversation_id,
            "profile": gemini_client.get_current_profile(),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat failed: {e}",
        ) from e


@app.get("/gemini/conversations")
async def list_gemini_conversations(
    gemini_client: GeminiClientWrapper = Depends(get_gemini_client),
) -> dict[str, Any]:
    """List all conversations from gemini-webapi.

    Args:
        gemini_client: Injected GeminiClientWrapper dependency.

    Returns:
        Dict with conversations list.

    Raises:
        HTTPException: 503 if client not initialized.
    """
    if not await gemini_client.ensure_initialized():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client not initialized. Use /gemini/chat to initialize.",
        )
    try:
        conversations = await gemini_client.list_conversations()
        return {
            "conversations": conversations,
            "count": len(conversations),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list conversations: {e}",
        ) from e


@app.delete("/gemini/conversations/{conversation_id}")
async def delete_gemini_conversation(
    conversation_id: str,
    gemini_client: GeminiClientWrapper = Depends(get_gemini_client),
) -> dict[str, str]:
    """Delete a conversation from gemini-webapi.

    Args:
        conversation_id: Conversation ID to delete.
        gemini_client: Injected GeminiClientWrapper dependency.

    Returns:
        Dict with status and message.

    Raises:
        HTTPException: 503 if client not initialized, 500 if deletion fails.
    """
    if not await gemini_client.ensure_initialized():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client not initialized. Use /gemini/chat to initialize.",
        )
    try:
        success = await gemini_client.delete_conversation(conversation_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete conversation '{conversation_id}'",
            )
        return {
            "status": "success",
            "message": f"Conversation '{conversation_id}' deleted",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Conversation deletion failed: {e}",
        ) from e


# ----- GitHub Integration Endpoints -----
class GitHubFileReadReq(BaseModel):
    """Request model for reading a file from GitHub.

    Attributes:
        config: GitHub configuration (token, owner, repo, branch).
        path: File path in repository.
    """

    config: GitHubConfig
    path: str = Field(..., min_length=1)


class GitHubFileWriteReq(BaseModel):
    """Request model for writing/updating a file to GitHub.

    Attributes:
        config: GitHub configuration (token, owner, repo, branch).
        path: File path in repository.
        content: File content to write.
        message: Commit message.
        sha: File SHA for updates (optional, required for existing files).
    """

    config: GitHubConfig
    path: str = Field(..., min_length=1)
    content: str
    message: str = Field(..., min_length=1)
    sha: str | None = None


class GitHubListReq(BaseModel):
    """Request model for listing directory contents.

    Attributes:
        config: GitHub configuration (token, owner, repo, branch).
        path: Directory path in repository (empty for root).
    """

    config: GitHubConfig
    path: str = ""


@app.post("/github/file/read")
async def github_read_file(r: GitHubFileReadReq) -> dict[str, Any]:
    """Read a file from GitHub repository.

    Args:
        r: GitHubFileReadReq with config and file path.

    Returns:
        Dict with file content, sha, and metadata.

    Raises:
        HTTPException: 404 if file not found, 500 on other errors.
    """
    try:
        service = GitHubService(r.config)
        result = await service.get_file(r.path)
        return result
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {r.path}",
            ) from e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GitHub API error: {e}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file: {e}",
        ) from e


@app.post("/github/file/write")
async def github_write_file(r: GitHubFileWriteReq) -> dict[str, Any]:
    """Create or update a file in GitHub repository.

    Args:
        r: GitHubFileWriteReq with config, path, content, message, and optional sha.

    Returns:
        Dict with commit and file metadata.

    Raises:
        HTTPException: 409 if SHA mismatch, 500 on other errors.
    """
    try:
        service = GitHubService(r.config)
        result = await service.create_or_update_file(
            r.path, r.content, r.message, r.sha
        )
        return result
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 409:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="File SHA mismatch. Fetch file again before updating.",
            ) from e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GitHub API error: {e}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write file: {e}",
        ) from e


@app.post("/github/list")
async def github_list_directory(r: GitHubListReq) -> dict[str, Any]:
    """List files in a GitHub repository directory.

    Args:
        r: GitHubListReq with config and directory path.

    Returns:
        Dict with list of files and directories.

    Raises:
        HTTPException: 404 if directory not found, 500 on other errors.
    """
    try:
        service = GitHubService(r.config)
        items = await service.list_directory(r.path)
        return {
            "items": items,
            "count": len(items),
            "path": r.path,
        }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Directory not found: {r.path}",
            ) from e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GitHub API error: {e}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list directory: {e}",
        ) from e


class GitHubBranchesReq(BaseModel):
    """Request model for listing branches.

    Attributes:
        config: GitHub configuration (token, owner, repo).
    """

    config: GitHubConfig


@app.post("/github/branches")
async def github_list_branches(r: GitHubBranchesReq) -> dict[str, Any]:
    """List all branches in a GitHub repository.

    Args:
        r: GitHubBranchesReq with config.

    Returns:
        Dict with list of branches.

    Raises:
        HTTPException: 500 on API errors.
    """
    try:
        service = GitHubService(r.config)
        branches = await service.get_branches()
        return {
            "branches": branches,
            "count": len(branches),
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GitHub API error: {e}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list branches: {e}",
        ) from e


# ===== OPEN WEBUI INTEGRATION FEATURES =====

# Additional endpoints inspired by Open WebUI functionality


@app.get("/api/config")
async def get_config():
    """Get Open WebUI-like configuration."""
    return {
        "version": "0.7.2",
        "theme": "dark",
        "ui": {
            "announcement": "",
            "name": "Gemini Web Wrapper",
            "logo": "/icon-192.png",
            "default_locale": "en-US",
            "sync": True,
        },
    }


@app.get("/api/models")
async def get_models():
    """Get available models, similar to Open WebUI."""
    return {
        "data": [
            {
                "id": "gemini-2.5-flash",
                "name": "Gemini 2.5 Flash",
                "object": "model",
                "created": 1677610602,
                "owned_by": "google",
                "meta": {"requirements": []},
                "info": {},
                "preset": True,
            },
            {
                "id": "gemini-2.5-pro",
                "name": "Gemini 2.5 Pro",
                "object": "model",
                "created": 1677610602,
                "owned_by": "google",
                "meta": {"requirements": []},
                "info": {},
                "preset": True,
            },
            {
                "id": "gemini-3.0-pro",
                "name": "Gemini 3.0 Pro",
                "object": "model",
                "created": 1677610602,
                "owned_by": "google",
                "meta": {"requirements": []},
                "info": {},
                "preset": True,
            },
        ]
    }


@app.get("/api/version")
async def get_version():
    """Get version info, similar to Open WebUI."""
    return {"version": "0.7.2"}


@app.get("/api/user")
async def get_user_info():
    """Get user info, similar to Open WebUI."""
    return {
        "id": "default-user",
        "email": "user@example.com",
        "name": "Default User",
        "role": "user",
        "profile_image_url": "/icon-192.png",
    }


class ChatHistoryItem(BaseModel):
    id: str
    user_id: str
    session_id: str | None
    chat: dict
    timestamp: int


@app.post("/api/chat/history")
async def save_chat_history(chat_data: dict):
    """Save chat history, similar to Open WebUI."""
    # In a real implementation, this would save to a database
    # For now, we'll just return success
    return {"status": True, "message": "Chat history saved successfully"}


@app.get("/api/chat/history")
async def get_chat_history():
    """Get chat history, similar to Open WebUI."""
    # In a real implementation, this would fetch from a database
    # For now, we'll return an empty history
    return {"history": [], "count": 0}


@app.delete("/api/chat/history/{chat_id}")
async def delete_chat_history(chat_id: str):
    """Delete specific chat history, similar to Open WebUI."""
    # In a real implementation, this would delete from a database
    return {"status": True, "message": f"Chat history {chat_id} deleted successfully"}


# Documents and RAG features (similar to Open WebUI)
class DocumentUploadReq(BaseModel):
    filename: str
    content: str
    collection_name: str = "default"


@app.post("/api/document/upload")
async def upload_document(doc_req: DocumentUploadReq):
    """Upload a document for RAG, similar to Open WebUI."""
    # In a real implementation, this would store the document in a vector DB
    return {
        "status": True,
        "filename": doc_req.filename,
        "message": f"Document {doc_req.filename} uploaded successfully",
    }


@app.get("/api/documents")
async def get_documents():
    """Get list of documents, similar to Open WebUI."""
    # In a real implementation, this would fetch from a vector DB
    return {"documents": [], "count": 0}


@app.delete("/api/document/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a document, similar to Open WebUI."""
    return {"status": True, "message": f"Document {doc_id} deleted successfully"}


# Tools management (similar to Open WebUI)
class Tool(BaseModel):
    id: str
    name: str
    description: str
    json_schema: dict
    scope: str = "chat"


@app.get("/api/tools")
async def get_tools():
    """Get available tools, similar to Open WebUI."""
    return {"tools": [], "count": 0}


@app.post("/api/tool")
async def create_tool(tool: Tool):
    """Create a new tool, similar to Open WebUI."""
    return {
        "status": True,
        "message": f"Tool {tool.name} created successfully",
    }


# ----- Static File Serving (Frontend / PWA) -----
# Keep this at the end so API routes take precedence.
mimetypes.add_type("application/manifest+json", ".webmanifest")
_frontend_dist_dir = os.environ.get("FRONTEND_DIST_DIR", "frontend/dist")
if os.path.isdir(_frontend_dist_dir):
    app.mount(
        "/",
        StaticFiles(directory=_frontend_dist_dir, html=True),
        name="frontend",
    )


if __name__ == "__main__":
    import uvicorn

    # Use uvloop for production performance
    # Listen on the PORT env var (Render requirement), default to 9000 for local
    port = int(os.environ.get("PORT", 9000))
    uvicorn.run(
        "server:app",
        host="0.0.0.0",  # nosec B104
        port=port,
        loop="uvloop",
        reload=False,
    )
