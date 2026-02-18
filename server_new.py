#!/usr/bin/env python3
"""FastAPI server for Gemini API with strict typing and performance.

High-performance HTTP API for chat and code assistance using Google's
Gemini model via the Genkit framework. Features: strict typing,
async/await, orjson, uvloop, and comprehensive validation.

This is the main application entry point that configures and runs
the FastAPI server with modular endpoint organization.
"""

import mimetypes
import os
from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

# Import endpoint routers
from endpoints.chat import router as chat_router
from endpoints.openai import router as openai_router
from endpoints.profiles import router as profiles_router
from endpoints.gemini import router as gemini_router
from endpoints.github import router as github_router
from endpoints.openwebui import router as openwebui_router
from endpoints.sessions import router as sessions_router

# Import lifespan management
from lifespan import lifespan

if TYPE_CHECKING:
    from fastapi import FastAPI

# ----- App Initialization -----
app = FastAPI(
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
    title="Genkit Gemini Server",
    docs_url=None,  # Disable documentation to avoid schema generation issues
    redoc_url=None,  # Disable redoc to avoid schema generation issues
    openapi_url=None,  # Disable OpenAPI schema to avoid httpx.Client schema issues
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, replace "*" with your Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----- Include Endpoint Routers -----
# Include all endpoint routers with their prefixes
app.include_router(chat_router)
app.include_router(openai_router)
app.include_router(profiles_router)
app.include_router(gemini_router)
app.include_router(github_router)
app.include_router(openwebui_router)
app.include_router(sessions_router)

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


# ----- Main Entry Point -----
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