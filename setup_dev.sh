#!/bin/bash
set -e

echo "Setting up development environment..."

# ---- Python backend ----
echo "Installing Python dependencies..."
if command -v uv &> /dev/null; then
    uv sync
else
    echo "uv not found. Install it: https://docs.astral.sh/uv/"
    exit 1
fi

# ---- Frontend ----
if [ -d "frontend" ]; then
    echo "Installing frontend dependencies..."
    if command -v bun &> /dev/null; then
        cd frontend
        bun install
        cd ..
    else
        echo "bun not found. Install it: https://bun.sh"
        exit 1
    fi
fi

# ---- Zagi (agent-optimised git CLI) ----
if command -v zagi &> /dev/null; then
    echo "zagi already installed: $(zagi --version)"
else
    echo "Installing zagi (agent-optimised git)..."
    curl -fsSL https://zagi.sh/install | sh
    echo "Restart your shell or run: source ~/.bashrc"
fi

# ---- Environment file ----
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please update .env with your API keys."
fi

echo ""
echo "Development environment ready."
echo "  Backend:  uv run uvicorn server:app --reload"
echo "  Frontend: cd frontend && bun run dev"
