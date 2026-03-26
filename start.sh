#!/bin/bash
set -e

echo "Starting Gemini Web Wrapper..."

if [ ! -f ".env" ]; then
    echo ".env file not found, creating from .env.example"
    cp .env.example .env
    echo "Please update .env with your API keys"
    echo "  Required: GOOGLE_API_KEY"
    echo "  Optional: ANTHROPIC_API_KEY"
fi

if [ ! -d "apps/web/dist" ]; then
    echo "Building frontend..."
    cd apps/web
    bun install
    bun run build
    cd ../..
fi

echo "Installing Python dependencies..."
cd apps/api
uv sync --frozen

echo "Starting packaged API server..."
PYTHONPATH=src:../../packages/config/src uv run uvicorn affine.api.server:app --host 0.0.0.0 --port "${PORT:-9000}"
