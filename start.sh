#!/bin/bash
set -e

echo "Starting Gemini Web Wrapper..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo ".env file not found, creating from .env.example"
    cp .env.example .env
    echo "Please update .env with your API keys"
    echo "  Required: GOOGLE_API_KEY"
    echo "  Optional: ANTHROPIC_API_KEY"
fi

# Build frontend if not already built
if [ ! -d "frontend/dist" ]; then
    echo "Building frontend..."
    cd frontend
    bun install
    bun run build
    cd ..
fi

# Install Python dependencies
echo "Installing Python dependencies..."
uv sync --frozen

echo "Starting server..."
uv run uvicorn server:app --host 0.0.0.0 --port "${PORT:-9000}"
