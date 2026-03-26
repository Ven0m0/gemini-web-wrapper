#!/bin/bash
set -e

echo "Setting up development environment..."

echo "Installing Python dependencies..."
if command -v uv &> /dev/null; then
    cd apps/api
    uv sync
    cd ../..
else
    echo "uv not found. Install it: https://docs.astral.sh/uv/"
    exit 1
fi

if [ -d "apps/web" ]; then
    echo "Installing frontend dependencies..."
    if command -v bun &> /dev/null; then
        cd apps/web
        bun install
        cd ../..
    else
        echo "bun not found. Install it: https://bun.sh"
        exit 1
    fi
fi

if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please update .env with your API keys."
fi

echo ""
echo "Development environment ready."
echo "  Backend:  cd apps/api && PYTHONPATH=src:../../packages/config/src uv run uvicorn affine.api.server:app --reload"
echo "  Frontend: cd apps/web && bun run dev"
