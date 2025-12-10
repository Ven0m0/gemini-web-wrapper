#!/usr/bin/env python3
"""FastAPI server for Gemini API with strict typing and performance.

High-performance HTTP API for chat and code assistance using Google's
Gemini model via the Genkit framework. Features: strict typing,
async/await, orjson, uvloop, and comprehensive validation.
"""

import asyncio
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Protocol

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import ORJSONResponse
from genkit import Genkit
from genkit.core.action import ActionResponse
from genkit.plugins.google_genai import google_genai
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
class AppState:
    """Global application state for Genkit resources."""

    genkit: Genkit | None = None
    model: GenkitModel | None = None


state = AppState()


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
    except Exception as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)

    # Initialize Genkit
    # Note: Assuming Genkit init is synchronous.
    # If it performs I/O, wrap in to_thread.
    state.genkit = Genkit(
        plugins=[google_genai(api_key=settings.google_api_key)]
    )
    state.model = state.genkit.get_model(
        settings.model_provider, settings.model_name
    )

    yield

    # Cleanup if necessary
    state.genkit = None
    state.model = None


# ----- App Initialization -----
app = FastAPI(
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
    title="Genkit Gemini Server",
)


# ----- Models -----
class ChatReq(BaseModel):
    """Request model for chat endpoint.

    Attributes:
        prompt: User message/question (min 1 character).
        system: Optional system message to set context/behavior.
    """

    prompt: str = Field(..., min_length=1)
    system: str | None = Field(default=None)


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
    except Exception as e:
        # Log error in production
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e


@app.get("/health")
async def health() -> dict[str, bool]:
    """Health check endpoint.

    Returns:
        Dict with 'ok: True' indicating service is running.
    """
    return {"ok": True}


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
