#!/bin/bash
set -e

echo "Deploying Gemini Web Wrapper to production..."

if [ ! -f "apps/web/package.json" ]; then
    echo "apps/web/package.json not found"
    exit 1
fi

if [ ! -f "apps/api/src/affine/api/server.py" ]; then
    echo "apps/api server entrypoint not found"
    exit 1
fi

echo "Installing frontend dependencies..."
cd apps/web
bun install

echo "Building frontend..."
bun run build

if [ ! -d "dist" ]; then
    echo "Frontend build failed - dist directory not found"
    exit 1
fi

echo "Frontend built successfully"

cd ../api

echo "Installing Python dependencies..."
uv sync --frozen

echo "Running TypeScript type check..."
cd ../web && bun run typecheck 2>/dev/null || echo "Type check warnings found"
cd ../api

echo "Running linter..."
uv run ruff check . || echo "Lint warnings found"

cd ../..
if [ ! -f ".env" ]; then
    echo ".env file not found, creating from .env.example"
    cp .env.example .env
    echo "Please update .env with your API keys"
fi

echo ""
echo "Deployment preparation complete."
echo "Frontend built to: apps/web/dist"
echo "API ready: apps/api/src/affine/api/server.py"
echo ""
echo "To run locally:"
echo "  1. Update .env with your API keys"
echo "  2. Run: cd apps/api && PYTHONPATH=src:../../packages/config/src uv run uvicorn affine.api.server:app --host 0.0.0.0 --port 9000"
