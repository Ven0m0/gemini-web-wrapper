#!/usr/bin/env python3
import asyncio
import sys
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import ORJSONResponse
from genkit import Genkit
from genkit.core.action import ActionResponse
from genkit.plugins.google_genai import google_genai
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


# ----- Configuration -----
class Settings(BaseSettings):
    google_api_key: str
    model_provider: str = "google"
    model_name: str = "gemini-2.0-flash"

    class Config:
        env_file = ".env"


# ----- State Management -----
class AppState:
    genkit: Genkit | None = None
    model: Any | None = None  # Specific type depends on Genkit internals


state = AppState()


# ----- Lifespan -----
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize Genkit resources on startup."""
    try:
        settings = Settings()
    except Exception as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)

    # Initialize Genkit
    # Note: Assuming Genkit init is synchronous.
    # If it performs I/O, wrap in to_thread.
    state.genkit = Genkit(plugins=[google_genai(api_key=settings.google_api_key)])
    state.model = state.genkit.get_model(settings.model_provider, settings.model_name)

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
    prompt: str = Field(..., min_length=1)
    system: str | None = Field(default=None)


class CodeReq(BaseModel):
    code: str = Field(..., min_length=1)
    instruction: str = Field(..., min_length=1)


class GenResponse(BaseModel):
    text: str


# ----- Logic Helpers -----
async def run_generate(messages: str | list[dict[str, str]]) -> ActionResponse:
    """Run generation in a thread pool to avoid blocking the event loop."""
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
