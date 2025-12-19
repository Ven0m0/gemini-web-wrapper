#!/usr/bin/env python3
"""FastAPI server for Gemini API with strict typing and performance. 

High-performance HTTP API for chat and code assistance using Google's
Gemini model via the Genkit framework.  Features:  strict typing,
async/await, orjson, uvloop, and comprehensive validation. 
"""

import asyncio
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from collections.abc import AsyncGenerator, Callable
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol
from uuid import uuid4

from cachetools import TTLCache
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse, StreamingResponse
from genkit. ai import Genkit
from genkit.plugins. google_genai import GoogleAI
from memori import Memori
from pydantic import BaseModel, Field, field_validator
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
    """Application settings loaded from environment or . env file."""

    google_api_key: str
    model_provider: str = "google"
    model_name: str = "gemini-2.5-flash"
    model_aliases: dict[str, str] = {
        "gpt-4o-mini": "gemini-2.5-flash",
        "gpt-4o": "gemini-2.5-pro",
        "gpt-4. 1-mini": "gemini-3. 0-pro",
        "gemini-flash": "gemini-2.5-flash",
        "gemini-pro": "gemini-2.5-pro",
        "gemini-3-pro": "gemini-3.0-pro",
    }
    max_upload_size_mb: int = 5
    ocr_cache_ttl:  int = 3600

    class Config:
        """Pydantic configuration."""
        env_file = ".env"

    def resolve_model(self, requested:  str | None) -> str:
        """Return a Gemini model name for a requested OpenAI-style name."""
        if not requested:
            return self.model_name
        return self.model_aliases.get(requested, requested)


# ----- Type Definitions -----
class GenerateResponse(Protocol):
    """Protocol defining the response from model generation."""

    @property
    def text(self) -> str:
        """Generated text from the model."""
        ... 


class GenkitModel(Protocol):
    """Protocol defining the interface for Genkit model objects."""

    def generate(self, messages: str | list[dict[str, str]]) -> GenerateResponse:
        """Generate a response from the model."""
        ... 


# ----- State Management -----
@dataclass
class AppState:
    """Global application state for Genkit and Memori resources."""
    genkit:  Genkit | None = None
    model: GenkitModel | None = None
    memori: Memori | None = None
    settings: Settings = field(default_factory=Settings)
    cookie_manager: CookieManager | None = None
    gemini_client: GeminiClientWrapper | None = None
    ocr_cache: TTLCache[str, str] = field(default_factory=lambda: TTLCache(maxsize=1024, ttl=3600))


state = AppState()


# ----- OCR Schemas -----
class OCRRequest(BaseModel):
    """OCR request payload (multipart)."""
    prompt: str = "Please transcribe this image"
    model: str | None = None


class OCRResponse(BaseModel):
    """OCR response payload."""
    text: str
    cached: bool = False


class BatchOCRResponse(BaseModel):
    """Batch OCR response payload."""
    results: list[OCRResponse]
    total: int


# ----- Helper Functions -----
def compute_file_hash(content: bytes) -> str:
    """Compute SHA256 hash of file content for caching."""
    return hashlib.sha256(content).hexdigest()


def detect_mime(filename: str, content: bytes) -> str:
    """Detect MIME type from filename and content magic bytes."""
    lower = filename.lower()
    if lower.endswith(".jpg") or lower.endswith(".jpeg"):
        return "image/jpeg"
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".gif"):
        return "image/gif"
    if lower.endswith(".webp"):
        return "image/webp"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG"):
        return "image/png"
    if content.startswith(b"GIF8"):
        return "image/gif"
    if content.startswith(b"RIFF") and b"WEBP" in content[: 20]:
        return "image/webp"
    return "application/octet-stream"


async def ocr_image_genkit(
    image_data: bytes,
    mime_type: str,
    prompt: str,
    model_name: str,
) -> str:
    """Perform OCR using Genkit Gemini model with vision capability."""
    if not state.genkit:
        raise HTTPException(status_code=500, detail="Genkit not initialized")
    
    # Import Part types from Genkit
    from genkit.ai import Part
    
    # Construct multi-part content for vision model
    content = [
        Part.from_bytes(image_data, mime_type=mime_type),
        Part.from_text(prompt),
    ]
    
    # Use the configured model (e.g., gemini-2.0-flash-lite)
    resolved_model = state.settings.resolve_model(model_name)
    model = state.genkit.define_model(resolved_model)
    
    # Generate response
    response = await run_in_thread(model.generate, content)
    return response.text. strip()


# ----- Lifecycle -----
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application lifecycle:  startup and shutdown."""
    settings = Settings()
    state.settings = settings
    state.ocr_cache = TTLCache(maxsize=1024, ttl=settings.ocr_cache_ttl)
    
    # Initialize Genkit with Google AI
    state.genkit = Genkit(plugins=[GoogleAI(api_key=settings.google_api_key)])
    state.model = state.genkit.define_model(settings.model_name)
    
    # Initialize Memori
    state. memori = Memori()
    state.memori.llm.register(
        "default",
        lambda text, model=None: state.model.generate(text).text if state.model else "",
        max_tok=8192,
    )
    
    # Initialize cookie manager
    state.cookie_manager = CookieManager()
    await state.cookie_manager.initialize()
    
    # Initialize Gemini client wrapper
    state.gemini_client = GeminiClientWrapper(state.cookie_manager)
    
    print(f"Server started with model: {settings.model_name}", file=sys.stderr)
    yield
    
    # Cleanup
    if state.cookie_manager:
        await state. cookie_manager.close()
    print("Server shutdown complete", file=sys.stderr)


app = FastAPI(
    title="Gemini LAN Wrapper",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----- Health Check -----
@app.get("/health")
async def health() -> dict[str, bool]:
    """Health check endpoint."""
    return {"ok": True}


# ----- OCR Endpoints -----
@app.post("/ocr", response_model=OCRResponse)
@handle_generation_errors
async def ocr_single(
    file: UploadFile = File(... ),
    prompt: str = "Please transcribe this image",
    model:  str | None = None,
) -> OCRResponse:
    """Perform OCR on a single uploaded image. 
    
    Args:
        file: Image file (JPEG/PNG/GIF/WebP).
        prompt: Optional custom prompt for transcription.
        model: Optional model override.
    
    Returns:
        OCRResponse with transcribed text.
    """
    if not file.filename: 
        raise HTTPException(status_code=400, detail="Filename is required")
    
    # Read file content
    content = await file.read()
    max_size = state.settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"File too large (max {state.settings.max_upload_size_mb}MB)",
        )
    
    # Detect MIME type
    mime_type = detect_mime(file.filename, content)
    if not mime_type. startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported")
    
    # Check cache
    file_hash = compute_file_hash(content)
    cache_key = f"{file_hash}:{prompt}:{model or 'default'}"
    if cache_key in state.ocr_cache:
        return OCRResponse(text=state.ocr_cache[cache_key], cached=True)
    
    # Perform OCR
    text = await ocr_image_genkit(content, mime_type, prompt, model or state.settings.model_name)
    
    # Cache result
    state.ocr_cache[cache_key] = text
    
    return OCRResponse(text=text, cached=False)


@app.post("/ocr/batch", response_model=BatchOCRResponse)
@handle_generation_errors
async def ocr_batch(
    files: list[UploadFile] = File(...),
    prompt: str = "Please transcribe this image",
    model: str | None = None,
) -> BatchOCRResponse:
    """Perform OCR on multiple images concurrently.
    
    Args:
        files: List of image files. 
        prompt: Optional custom prompt for transcription.
        model: Optional model override.
    
    Returns:
        BatchOCRResponse with list of transcribed texts.
    """
    if not files:
        raise HTTPException(status_code=400, detail="At least one file required")
    
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files per batch")
    
    # Process all files concurrently
    async def process_one(file: UploadFile) -> OCRResponse:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Filename is required")
        
        content = await file.read()
        max_size = state.settings.max_upload_size_mb * 1024 * 1024
        if len(content) > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File {file.filename} too large (max {state.settings.max_upload_size_mb}MB)",
            )
        
        mime_type = detect_mime(file. filename, content)
        if not mime_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} is not an image",
            )
        
        # Check cache
        file_hash = compute_file_hash(content)
        cache_key = f"{file_hash}:{prompt}:{model or 'default'}"
        if cache_key in state.ocr_cache:
            return OCRResponse(text=state.ocr_cache[cache_key], cached=True)
        
        # Perform OCR
        text = await ocr_image_genkit(content, mime_type, prompt, model or state.settings.model_name)
        
        # Cache result
        state.ocr_cache[cache_key] = text
        
        return OCRResponse(text=text, cached=False)
    
    results = await asyncio.gather(*[process_one(f) for f in files])
    
    return BatchOCRResponse(results=results, total=len(results))


# ----- Existing Endpoints (Chat, Code, etc.) -----
# ... (rest of your existing endpoints remain unchanged)