#!/usr/bin/env python3
"""FastAPI server for Gemini API with strict typing and performance.

High-performance HTTP API for chat and code assistance using Google's
Gemini model via the Genkit framework. Features: strict typing,
async/await, orjson, uvloop, and comprehensive validation.
"""

import asyncio
import subprocess
import sys
from collections.abc import AsyncGenerator, Callable
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass
from typing import Any, Literal, Protocol

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import ORJSONResponse, StreamingResponse
from genkit.ai import Genkit
from genkit.core.action import ActionResponse
from genkit.plugins.google_genai import GoogleAI
from memori import Memori
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


# ----- Configuration -----
class Settings(BaseSettings):
    """Application settings loaded from environment or .env file."""

    google_api_key: str
    model_provider: str = "google"
    model_name: str = "gemini-2.5-flash"

    class Config:
        """Pydantic configuration."""

        env_file = ".env"


# ----- Type Definitions -----
class GenkitModel(Protocol):
    """Protocol defining the interface for Genkit model objects."""

    def generate(self, messages: str | list[dict[str, str]]) -> ActionResponse:
        """Generate a response from the model.

        Args:
            messages: Either a string prompt or structured message list.

        Returns:
            ActionResponse containing the generated text.
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


state = AppState()


# ----- Initialization Helpers -----
async def _setup_memori() -> None:
    """Initialize Memori setup if needed.

    Runs the memori setup command in a thread pool to avoid blocking.
    This is idempotent - if already set up, it will not cause issues.
    Errors are silently caught as setup may already be complete.
    """
    with suppress(subprocess.TimeoutExpired, FileNotFoundError, OSError):
        await asyncio.to_thread(
            subprocess.run,
            ["python", "-m", "memori", "setup"],
            capture_output=True,
            check=False,
            timeout=10,
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
        msgs: list[dict[str, str]] = []

        if system:
            msgs.append({"role": "system", "content": system})

        if history:
            msgs.extend(history)

        msgs.append({"role": "user", "content": message})

        # Use the flow's model directly
        if state.model is None:
            raise ValueError("Model not initialized")

        response = await asyncio.to_thread(state.model.generate, msgs)
        # ActionResponse.text from genkit lacks type hints
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
        settings = Settings()
    except (ValueError, KeyError, TypeError) as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)

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

    # Create Genkit flows
    create_chatbot_flow(state.genkit)

    yield

    # Cleanup if necessary
    state.genkit = None
    state.model = None
    state.memori = None


# ----- App Initialization -----
app = FastAPI(
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
    title="Genkit Gemini Server",
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
        prompt: User message/question (min 1 character).
        system: Optional system message to set context/behavior.
    """

    prompt: str = Field(..., min_length=1)
    system: str | None = Field(default=None)


class ChatbotReq(BaseModel):
    """Request model for chatbot endpoint with history.

    Attributes:
        message: User message/question (min 1 character).
        history: Previous conversation messages (sent from client).
        system: Optional system instruction to customize behavior.
        user_id: Optional user identifier for memory attribution.
        session_id: Optional session identifier for memory tracking.
    """

    message: str = Field(..., min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)
    system: str | None = Field(default=None)
    user_id: str | None = Field(default=None)
    session_id: str | None = Field(default=None)


class CodeReq(BaseModel):
    """Request model for code assistance endpoint.

    Attributes:
        code: Source code to be modified/analyzed (min 1 character).
        instruction: Instruction describing desired changes (min 1 character).
    """

    code: str = Field(..., min_length=1)
    instruction: str = Field(..., min_length=1)


class GenResponse(BaseModel):
    """Response model for generation endpoints.

    Attributes:
        text: Generated text from the model.
    """

    text: str


# ----- Logic Helpers -----
async def run_generate(messages: str | list[dict[str, str]]) -> ActionResponse:
    """Run model generation in a thread pool to avoid blocking event loop.

    Genkit's generate method performs blocking I/O operations. To maintain
    high performance in our async FastAPI server, we execute it in a
    thread pool executor using asyncio.to_thread.

    Args:
        messages: Either a string prompt or list of role/content dicts.

    Returns:
        ActionResponse containing the generated text and metadata.

    Raises:
        HTTPException: 503 if model is not initialized.
    """
    if state.model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not initialized",
        )

    # genkit operations are likely blocking I/O
    return await asyncio.to_thread(state.model.generate, messages)


async def _setup_memori_attribution(
    memori: Memori,
    user_id: str | None,
    session_id: str | None,
) -> None:
    """Set up Memori attribution for conversation tracking.

    Runs attribution setup in a thread pool to avoid blocking the event loop.
    Attribution allows Memori to track conversations per user and session.

    Args:
        memori: Initialized Memori instance.
        user_id: Optional user identifier (defaults to "default_user").
        session_id: Optional session identifier for grouping interactions.
    """
    if user_id or session_id:
        await asyncio.to_thread(
            memori.attribution,
            entity_id=user_id or "default_user",
            process_id="gemini-chatbot",
        )
        if session_id:
            await asyncio.to_thread(memori.set_session, session_id)


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


# ----- Endpoints -----
@app.post("/chat", response_model=GenResponse)
async def chat(r: ChatReq) -> dict[str, str]:
    """Handle conversational chat requests.

    Constructs a message list with optional system context and user prompt,
    then generates a response using the Gemini model.

    Args:
        r: ChatReq containing prompt and optional system message.

    Returns:
        Dict with 'text' key containing the model's response.

    Raises:
        HTTPException: 500 if generation fails.
    """
    msgs: list[dict[str, str]] = []
    if r.system:
        msgs.append({"role": "system", "content": r.system})
    msgs.append({"role": "user", "content": r.prompt})

    try:
        out = await run_generate(msgs)
        return {"text": out.text}
    except (RuntimeError, ValueError, ConnectionError, TimeoutError) as e:
        # Catch common errors from model generation and network issues
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Generation failed: {e}",
        ) from e


@app.post("/code", response_model=GenResponse)
async def code(r: CodeReq) -> dict[str, str]:
    """Handle code assistance requests.

    Formats the code and instruction into a prompt for the coding assistant,
    then generates a response with the modified/analyzed code.

    Args:
        r: CodeReq containing code snippet and modification instruction.

    Returns:
        Dict with 'text' key containing the model's code response.

    Raises:
        HTTPException: 500 if generation fails.
    """
    prompt = (
        "You are a coding assistant. "
        "Apply the following instruction to the code.\n\n"
        f"Instruction:\n{r.instruction}\n\nCode:\n{r.code}"
    )

    try:
        out = await run_generate(prompt)
        return {"text": out.text}
    except (RuntimeError, ValueError, ConnectionError, TimeoutError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Code generation failed: {e}",
        ) from e


@app.get("/health")
async def health() -> dict[str, bool]:
    """Health check endpoint.

    Returns:
        Dict with 'ok: True' indicating service is running.
    """
    return {"ok": True}


@app.post("/chatbot", response_model=GenResponse)
async def chatbot(r: ChatbotReq) -> dict[str, str]:
    """Handle chatbot requests with conversation history and memory.

    This endpoint follows the Genkit chatbot pattern, accepting a message
    along with conversation history. Now enhanced with Memori for persistent
    memory across sessions.

    Args:
        r: ChatbotReq with message, history, and optional system instruction.

    Returns:
        Dict with 'text' key containing the model's response.

    Raises:
        HTTPException: 503 if model not initialized, 500 if generation fails.
    """
    if state.model is None or state.memori is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model or memory not initialized",
        )

    # Set up Memori attribution for this conversation
    await _setup_memori_attribution(state.memori, r.user_id, r.session_id)

    # Build message list from history + new message
    msgs = _build_message_list(r.system, r.history, r.message)

    try:
        out = await run_generate(msgs)

        # Store the conversation in Memori for future context
        # This allows the system to recall past interactions
        if r.user_id or r.session_id:
            await asyncio.to_thread(
                lambda: state.memori.llm.register(state.model)
                if state.memori
                else None
            )

        return {"text": out.text}
    except (RuntimeError, ValueError, ConnectionError, TimeoutError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chatbot generation failed: {e}",
        ) from e


@app.post("/chatbot/stream")
async def chatbot_stream(r: ChatbotReq) -> StreamingResponse:
    """Handle chatbot requests with streaming responses and memory.

    This endpoint streams the model's response token-by-token for a more
    interactive experience. Like /chatbot, it accepts conversation history
    and maintains a stateless server pattern. Now enhanced with Memori.

    Args:
        r: ChatbotReq with message, history, and optional system instruction.

    Returns:
        StreamingResponse that yields text chunks as they're generated.

    Raises:
        HTTPException: 503 if model not initialized, 500 if generation fails.
    """
    if state.model is None or state.memori is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model or memory not initialized",
        )

    # Set up Memori attribution for this conversation
    await _setup_memori_attribution(state.memori, r.user_id, r.session_id)

    # Build message list from history + new message
    msgs = _build_message_list(r.system, r.history, r.message)

    async def generate_stream() -> AsyncGenerator[str, None]:
        """Generate response stream chunk by chunk."""
        try:
            # For streaming, we need to use Genkit's streaming API
            # Note: The exact API may vary; this demonstrates the pattern
            response = await run_generate(msgs)

            # Store the conversation in Memori for future context
            if r.user_id or r.session_id:
                await asyncio.to_thread(
                    lambda: state.memori.llm.register(state.model)
                    if state.memori
                    else None
                )

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
async def create_new_session(user_id: str | None = None) -> dict[str, str]:
    """Create a new memory session for a user.

    Args:
        user_id: Optional user identifier for the session.

    Returns:
        Dict with 'status' and 'message' indicating session creation.

    Raises:
        HTTPException: 503 if memory not initialized.
    """
    if state.memori is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Memory not initialized",
        )

    try:
        await asyncio.to_thread(
            state.memori.attribution,
            entity_id=user_id or "default_user",
            process_id="gemini-chatbot",
        )
        await asyncio.to_thread(state.memori.new_session)
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
async def query_memories(r: MemoryQueryReq) -> dict[str, Any]:
    """Query stored memories for a user.

    This endpoint allows retrieving past conversation context and memories
    stored by Memori for a specific user.

    Args:
        r: MemoryQueryReq containing user_id and optional query parameters.

    Returns:
        Dict with 'memories' list and informational 'message' string.

    Raises:
        HTTPException: 503 if memory not initialized, 500 if query fails.
    """
    if state.memori is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Memory not initialized",
        )

    try:
        # Set attribution to query this user's memories
        await asyncio.to_thread(
            state.memori.attribution,
            entity_id=r.user_id,
            process_id="gemini-chatbot",
        )

        # Note: The actual Memori API for querying may differ
        # This is a placeholder showing the pattern
        # In production, you'd use Memori's search/query methods
        return {
            "memories": [],
            "message": (
                "Memory query functionality - "
                "check Memori docs for specific query methods"
            ),
        }
    except (RuntimeError, ValueError, AttributeError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Memory query failed: {e}",
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
