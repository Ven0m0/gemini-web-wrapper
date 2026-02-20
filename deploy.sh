#!/bin/bash
set -e

echo "Deploying Gemini Web Wrapper to production..."

# Check required files
if [ ! -f "frontend/package.json" ]; then
    echo "frontend/package.json not found"
    exit 1
fi

if [ ! -f "server.py" ]; then
    echo "server.py not found"
    exit 1
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
bun install

# Build frontend
echo "Building frontend..."
bun run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "Frontend build failed - dist directory not found"
    exit 1
fi

echo "Frontend built successfully"

# Go back to root
cd ..

# Install Python dependencies
echo "Installing Python dependencies..."
uv sync --frozen

# Run type checks
echo "Running TypeScript type check..."
cd frontend && bun run typecheck 2>/dev/null || echo "Type check warnings found"
cd ..

# Run linting
echo "Running linter..."
uv run ruff check . || echo "Lint warnings found"

# Create environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo ".env file not found, creating from .env.example"
    cp .env.example .env
    echo "Please update .env with your API keys"
fi

echo ""
echo "Deployment preparation complete."
echo "Frontend built to: frontend/dist"
echo "Backend ready: server.py"
echo ""
echo "To run locally:"
echo "  1. Update .env with your API keys"
echo "  2. Run: uv run uvicorn server:app --host 0.0.0.0 --port 9000"
