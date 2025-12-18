#!/usr/bin/env python3
"""FastAPI server for Gemini API with strict typing and performance.

High-performance HTTP API for chat and code assistance using Google's
Gemini model via the Genkit framework. Features: strict typing,
async/await, orjson, uvloop, and comprehensive validation.
"""

import asyncio
import json
import os
import subprocess
import sys
import time
from collections.abc import AsyncGenerator, Callable
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol
from uuid import uuid4
from cachetools import TTLCache
from fastapi import Depends, FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse, StreamingResponse
from genkit.ai import Genkit
from genkit.plugins.google_genai import GoogleAI
from memori import Memori
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from cookie_manager import CookieManager
from gemini_client import GeminiClientWrapper
from openai_schemas import ChatCompletionRequest, ChatCompletionResponse
from openai_transforms import (
    collapse_messages,
    parse_tool_calls,
    to_chat_completion_response,
)
from utils import handle_generation_errors, run_in_thread

# ----- Configuration -----
class Settings(BaseSettings):
    """Application settings loaded from environment or .env file."""

    google_api_key: str
    model_provider: str = "google"
    model_name: str = "gemini-2.5-flash"
    # Model aliases for OpenAI compatibility
    model_aliases: dict[str, str] = {
        "gpt-4o-mini": "gemini-2.5-flash",
        "gpt-4o": "gemini-2.5-pro",
        "gpt-4.1-mini": "gemini-3.0-pro",
        "gemini-flash": "gemini-2.5-flash",
        "gemini-pro": "gemini-2.5-pro",
        "gemini-3-pro": "gemini-3.0-pro",
    }
    class Config:
        """Pydantic configuration."""

        env_file = ".env"
    def resolve_model(self, requested: str | None) -> str:
        """Return a Gemini model name for a requested OpenAI-style name."""
        if not requested:
            return self.model_name
        if requested in self.model_aliases:
            return self.model_aliases[requested]
        return requested

# ----- Type Definitions -----
class GenerateResponse(Protocol):
    """Protocol defining the response from model generation.

    This is a local Protocol to avoid importing genkit.core.action.ActionResponse
    and maintain compatibility across different genkit versions.
    """
    @property
    def text(self) -> str:
        """Generated text from the model."""
        ...

class GenkitModel(Protocol):
    """Protocol defining the interface for Genkit model objects."""
    def generate(
        self, messages: str | list[dict[str, str]]
    ) -> GenerateResponse:
        """Generate a response from the model.

        Args:
            messages: Either a string prompt or structured message list.

        Returns:
            GenerateResponse containing the generated text.
        """
        ...

# ----- State Management -----
@dataclass
class AppState:
    """Global application state for Genkit and Memori resources.

    Uses dataclass to ensure proper instance attribute initialization
    and avoid mutable class attribute anti-pattern.
    """
    genkit: Genkit | None = None
    model: GenkitModel | None = None
    memori: Memori | None = None
    chatbot_flow: Callable[..., Any] | None = None
    settings: Settings | None = None
    # Cache for attribution setup with TTL to prevent unbounded growth
    # maxsize=10000 entries, ttl=3600 seconds (1 hour)
    attribution_cache: TTLCache = field(
        default_factory=lambda: TTLCache(maxsize=10000, ttl=3600)
    )
    # Cookie management for gemini-webapi
    cookie_manager: CookieManager | None = None
    gemini_client: GeminiClientWrapper | None = None
state = AppState()

# ----- Initialization Helpers -----
async def _setup_memori() -> None:
    """Initialize Memori setup if needed.

    Runs the memori setup command in a thread pool to avoid blocking.
    This is idempotent - if already set up, it will not cause issues.
    Errors are silently caught as setup may already be complete.
    """
    with suppress(subprocess.TimeoutExpired, FileNotFoundError, OSError):
        await run_in_thread(
            subprocess.run,
            ["python", "-m", "memori", "setup"],
            capture_output=True,
            check=False,
            timeout=3,
        )

# ----- Genkit Flows -----
def create_chatbot_flow(ai: Genkit) -> None:
    """Create a Genkit flow for the chatbot.

    This demonstrates the @ai.flow() decorator pattern from Genkit docs.
    Flows provide type-safe inputs/outputs, built-in tracing, and
    Developer UI integration.

    Args:
        ai: Initialized Genkit instance.
    """
    @ai.flow()
    async def chatbot_flow(
        message: str,
        history: list[dict[str, str]] | None = None,
        system: str | None = None,
    ) -> str:
        """Genkit flow for chatbot with history.

        Args:
            message: User's message.
            history: Previous conversation messages.
            system: Optional system instruction.

        Returns:
            Model's response text.
        """
        # Use the flow's model directly
        if state.model is None:
            raise ValueError("Model not initialized")
        # Build message list using shared helper (consolidates logic)
        # Convert history from list[dict] to required ChatMessage format for helper
        class _DictMessage:
            """Temporary adapter for dict-based messages."""
            def __init__(self, d: dict[str, str]) -> None:
                self.role = d["role"]  # type: ignore
                self.content = d["content"]
        history_msgs = [_DictMessage(h) for h in history] if history else []
        msgs_list = _build_message_list(system, history_msgs, message)  # type: ignore
        response = await run_in_thread(state.model.generate, msgs_list)
        # GenerateResponse.text from genkit lacks type hints
        return str(response.text)
    # Store flow reference (optional, for later use)
    state.chatbot_flow = chatbot_flow

# ----- Lifespan -----
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
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
    # Initialize Genkit
    # Note: Assuming Genkit init is synchronous.
    # If it performs I/O, wrap in to_thread.
    state.genkit = Genkit(plugins=[GoogleAI(api_key=settings.google_api_key)])
    # Get model reference - format: "provider/model-name"
    model_path = f"{settings.model_provider}ai/{settings.model_name}"
    state.model = state.genkit.get_model(model_path)
    # Initialize Memori for persistent memory
    state.memori = Memori()
    # Register the LLM client with Memori (uses default attribution)
    # Note: Memori will automatically track conversations
    await _setup_memori()
    # Register the model with Memori once at startup (performance optimization)
    if state.model and state.memori:
        await run_in_thread(state.memori.llm.register, state.model)
    # Create Genkit flows
    create_chatbot_flow(state.genkit)
    # Initialize cookie manager and gemini-webapi client
    state.cookie_manager = CookieManager(db_path="gemini_cookies.db")
    await state.cookie_manager.init_db()
    state.gemini_client = GeminiClientWrapper(state.cookie_manager)
    yield
    # Cleanup if necessary
    state.genkit = None
    state.model = None
    state.memori = None
    state.settings = None
    state.cookie_manager = None
    state.gemini_client = None
    state.attribution_cache.clear()

# ----- App Initialization -----
app = FastAPI(
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
    title="Genkit Gemini Server",
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
    messages: str | list[dict[str, str]],
    model: GenkitModel,
    timeout: float = 30.0,
) -> GenerateResponse:
    """Run model generation in a thread pool to avoid blocking event loop.

    Genkit's generate method performs blocking I/O operations. To maintain
    high performance in our async FastAPI server, we execute it in a
    thread pool executor using run_in_thread with timeout protection.

    Args:
        messages: Either a string prompt or list of role/content dicts.
        model: Initialized GenkitModel instance.
        timeout: Maximum time to wait for generation (default 30 seconds).

    Returns:
        GenerateResponse containing the generated text and metadata.

    Raises:
        HTTPException: 504 if generation times out.
    """
    try:
        return await asyncio.wait_for(
            run_in_thread(model.generate, messages),
            timeout=timeout,
        )
    except TimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Model generation timed out after {timeout}s",
        ) from e

async def _setup_memori_attribution(
    memori: Memori,
    user_id: str | None,
    session_id: str | None,
) -> None:
    """Set up Memori attribution for conversation tracking.

    Runs attribution setup in a thread pool to avoid blocking the event loop.
    Attribution allows Memori to track conversations per user and session.
    Uses TTL cache to avoid redundant attribution calls for same user/session
    while preventing unbounded memory growth.

    Args:
        memori: Initialized Memori instance.
        user_id: Optional user identifier (defaults to "default_user").
        session_id: Optional session identifier for grouping interactions.
    """
    if user_id or session_id:
        # Create cache key from user_id and session_id
        effective_user_id = user_id or "default_user"
        cache_key = (effective_user_id, session_id)

        # Only set up attribution if not already cached
        if cache_key not in state.attribution_cache:
            await run_in_thread(
                memori.attribution,
                entity_id=effective_user_id,
                process_id="gemini-chatbot",
            )
            if session_id:
                await run_in_thread(memori.set_session, session_id)
            # Add to cache (TTLCache expires after 1 hour)
            state.attribution_cache[cache_key] = True
def _build_message_list(
    system: str | None,
    history: list[ChatMessage],
    message: str,
) -> list[dict[str, str]]:
    """Build a message list for model generation.

    Constructs a properly formatted message list from system instruction,
    conversation history, and current user message. Time complexity: O(n)
    where n is the length of history.

    Args:
        system: Optional system instruction to set model behavior.
        history: Previous conversation messages (may be empty).
        message: Current user message to append.

    Returns:
        List of message dicts with 'role' and 'content' keys.
    """
    msgs: list[dict[str, str]] = []
    if system:
        msgs.append({"role": "system", "content": system})
    # Extend with history - O(n) operation
    msgs.extend({"role": msg.role, "content": msg.content} for msg in history)
    msgs.append({"role": "user", "content": message})
    return msgs
async def _prepare_chatbot_messages(
    request: ChatbotReq,
    memori: Memori,
) -> list[dict[str, str]]:
    """Prepare chatbot messages and ensure attribution is set."""
    await _setup_memori_attribution(
        memori,
        request.user_id,
        request.session_id,
    )
    return _build_message_list(
        request.system,
        request.history,
        request.message,
    )

# ----- Dependencies -----
def get_model() -> GenkitModel:
    """FastAPI dependency to get the initialized model.

    Returns:
        Initialized GenkitModel instance.

    Raises:
        HTTPException: 503 if model is not initialized.
    """
    if state.model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not initialized. Check server logs.",
        )
    return state.model

def get_memori() -> Memori:
    """FastAPI dependency to get the initialized Memori instance.

    Returns:
        Initialized Memori instance.

    Raises:
        HTTPException: 503 if Memori is not initialized.
    """
    if state.memori is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Memory not initialized. Check server logs.",
        )
    return state.memori

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
    model: GenkitModel = Depends(get_model),
) -> dict[str, str]:
    """Handle conversational chat requests.

    Constructs a message list with optional system context and user prompt,
    then generates a response using the Gemini model.

    Args:
        r: ChatReq containing prompt and optional system message.
        model: Injected GenkitModel dependency.

    Returns:
        Dict with 'text' key containing the model's response.

    Raises:
        HTTPException: 500 if generation fails.
    """
    msgs = _build_message_list(r.system, [], r.prompt)

    out = await run_generate(msgs, model)
    return {"text": out.text}

@app.post("/code", response_model=GenResponse)
@handle_generation_errors
async def code(
    r: CodeReq,
    model: GenkitModel = Depends(get_model),
) -> dict[str, str]:
    """Handle code assistance requests.

    Formats the code and instruction into a prompt for the coding assistant,
    then generates a response with the modified/analyzed code.

    Args:
        r: CodeReq containing code snippet and modification instruction.
        model: Injected GenkitModel dependency.

    Returns:
        Dict with 'text' key containing the model's code response.

    Raises:
        HTTPException: 500 if generation fails.
    """
    # Use join for better performance with large code snippets
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
    out = await run_generate(prompt, model)
    return {"text": out.text}

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
    model: GenkitModel = Depends(get_model),
    memori: Memori = Depends(get_memori),
) -> dict[str, str]:
    """Handle chatbot requests with conversation history and memory.

    This endpoint follows the Genkit chatbot pattern, accepting a message
    along with conversation history. Now enhanced with Memori for persistent
    memory across sessions.

    Args:
        r: ChatbotReq with message, history, and optional system instruction.
        model: Injected GenkitModel dependency.
        memori: Injected Memori dependency.

    Returns:
        Dict with 'text' key containing the model's response.

    Raises:
        HTTPException: 503 if model not initialized, 500 if generation fails.
    """
    msgs = await _prepare_chatbot_messages(r, memori)
    out = await run_generate(msgs, model)
    # Note: Memori model registration now happens once at startup
    # for better performance instead of per-request
    return {"text": out.text}

@app.post("/chatbot/stream")
async def chatbot_stream(
    r: ChatbotReq,
    model: GenkitModel = Depends(get_model),
    memori: Memori = Depends(get_memori),
) -> StreamingResponse:
    """Handle chatbot requests with streaming responses and memory.

    This endpoint streams the model's response token-by-token for a more
    interactive experience. Like /chatbot, it accepts conversation history
    and maintains a stateless server pattern. Now enhanced with Memori.

    Args:
        r: ChatbotReq with message, history, and optional system instruction.
        model: Injected GenkitModel dependency.
        memori: Injected Memori dependency.

    Returns:
        StreamingResponse that yields text chunks as they're generated.

    Raises:
        HTTPException: 503 if model not initialized, 500 if generation fails.
    """
    msgs = await _prepare_chatbot_messages(r, memori)
    async def generate_stream() -> AsyncGenerator[str, None]:
        """Generate response stream chunk by chunk."""
        try:
            # For streaming, we need to use Genkit's streaming API
            # Note: The exact API may vary; this demonstrates the pattern
            response = await run_generate(msgs, model)
            # Note: Memori model registration now happens once at startup
            # for better performance instead of per-request
            # Yield the complete response (Genkit streaming API may differ)
            # In production, you'd use actual streaming if Genkit supports it
            yield response.text
        except (RuntimeError, ValueError, ConnectionError, TimeoutError) as e:
            yield f"Error: Generation failed - {e}"
    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
    )

@app.post("/memory/session/new")
async def create_new_session(
    user_id: str | None = None,
    memori: Memori = Depends(get_memori),
) -> dict[str, str]:
    """Create a new memory session for a user.

    Args:
        user_id: Optional user identifier for the session.
        memori: Injected Memori dependency.

    Returns:
        Dict with 'status' and 'message' indicating session creation.

    Raises:
        HTTPException: 503 if memory not initialized.
    """
    try:
        await run_in_thread(
            memori.attribution,
            entity_id=user_id or "default_user",
            process_id="gemini-chatbot",
        )
        await run_in_thread(memori.new_session)
        return {
            "status": "success",
            "message": "New memory session created",
        }
    except (RuntimeError, ValueError, AttributeError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Memory session creation failed: {e}",
        ) from e

class MemoryQueryReq(BaseModel):
    """Request model for memory query endpoint.

    Attributes:
        user_id: User identifier to query memories for.
        query: Optional search query for semantic memory retrieval.
        limit: Maximum number of memories to retrieve.
    """

    user_id: str = Field(..., min_length=1)
    query: str | None = Field(default=None)
    limit: int = Field(default=10, ge=1, le=100)

@app.post("/memory/query")
async def query_memories(
    r: MemoryQueryReq,
    memori: Memori = Depends(get_memori),
) -> dict[str, Any]:
    """Query stored memories for a user.

    This endpoint allows retrieving past conversation context and memories
    stored by Memori for a specific user.

    Args:
        r: MemoryQueryReq containing user_id and optional query parameters.
        memori: Injected Memori dependency.

    Returns:
        Dict with 'memories' list and informational 'message' string.

    Raises:
        HTTPException: 503 if memory not initialized, 500 if query fails.
    """
    try:
        # Set attribution to query this user's memories
        await run_in_thread(
            memori.attribution,
            entity_id=r.user_id,
            process_id="gemini-chatbot",
        )
        # Note: The actual Memori API for querying may differ
        # This is a placeholder showing the pattern
        # In production, you'd use Memori's search/query methods
        return {
            "memories": [],
            "message": (
                "Memory query functionality - check Memori docs "
                "for specific query methods"
            ),
        }
    except (RuntimeError, ValueError, AttributeError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Memory query failed: {e}",
        ) from e

# ----- OpenAI-Compatible Endpoints -----
async def generate_sse_response(
    text: str,
    model: str,
    request_id: str,
    include_usage: bool = False,
) -> AsyncGenerator[str, None]:
    """Generate SSE chunks that simulate streaming for a complete response."""
    created = int(time.time())
    # Split text into chunks (simulate streaming by sending in small pieces)
    # For now, send the entire response as one chunk since Gemini doesn't stream
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
                    "content": text,
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
) -> AsyncGenerator[str, None]:
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

@app.post("/v1/chat/completions")
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
                    "Failed to auto-initialize. Please login to "
                    "gemini.google.com or create a profile."
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
    tool_calls = []
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
                    "Failed to auto-initialize. Please login to "
                    "gemini.google.com or create a profile."
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

if __name__ == "__main__":
    import uvicorn
    # Use uvloop for production performance
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=9000,
        loop="uvloop",
        reload=True,
    )
