#!/bin/bash
set -e

echo "Verifying Gemini Web Wrapper deployment readiness..."

# Check bun
echo "Checking bun..."
if command -v bun &> /dev/null; then
    BUN_VERSION=$(bun --version)
    echo "bun version: $BUN_VERSION"
else
    echo "bun not found — install from https://bun.sh"
    exit 1
fi

# Check Python
echo "Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "Python version: $PYTHON_VERSION"
else
    echo "Python3 not found"
    exit 1
fi

# Check uv
echo "Checking uv..."
if command -v uv &> /dev/null; then
    UV_VERSION=$(uv --version 2>/dev/null || echo "unknown")
    echo "uv version: $UV_VERSION"
else
    echo "uv not found — install from https://docs.astral.sh/uv/"
    exit 1
fi

# Check zagi (agent-optimised git)
echo "Checking zagi..."
if command -v zagi &> /dev/null; then
    ZAGI_VERSION=$(zagi --version 2>/dev/null || echo "unknown")
    echo "zagi version: $ZAGI_VERSION"
else
    echo "zagi not found (optional). Install: curl -fsSL https://zagi.sh/install | sh"
fi

# Check required files
echo "Checking required files..."
REQUIRED_FILES=(
    "frontend/package.json"
    "server.py"
    "pyproject.toml"
    ".env.example"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "$file exists"
    else
        echo "$file missing"
        exit 1
    fi
done

# Check frontend dependencies
echo "Checking frontend dependencies..."
cd frontend
if [ -d "node_modules" ]; then
    echo "Frontend node_modules exists"
else
    echo "Frontend node_modules not found — run: cd frontend && bun install"
fi

# Check if frontend is built
if [ -d "dist" ]; then
    echo "Frontend built (dist directory exists)"
else
    echo "Frontend not built — run: cd frontend && bun run build"
fi
cd ..

# Check Python dependencies
echo "Checking Python dependencies..."
if uv run python -c "import fastapi" &> /dev/null; then
    echo "FastAPI installed"
else
    echo "FastAPI not installed — run: uv sync"
fi

# Check environment file
echo "Checking environment configuration..."
if [ -f ".env" ]; then
    echo ".env file exists"
    if grep -q "GOOGLE_API_KEY" .env; then
        echo "GOOGLE_API_KEY configured"
    else
        echo "GOOGLE_API_KEY not found in .env"
    fi
else
    echo ".env file not found — copy from .env.example"
fi

# TypeScript check
echo "Checking TypeScript..."
cd frontend
if bun run typecheck &> /dev/null; then
    echo "TypeScript compilation successful"
else
    echo "TypeScript compilation issues found"
fi
cd ..

echo ""
echo "Verification complete."
echo ""
echo "Next steps:"
echo "  1. Update .env with your API keys"
echo "  2. Build frontend:      cd frontend && bun run build"
echo "  3. Sync Python deps:    uv sync"
echo "  4. Start server:        uv run uvicorn server:app --host 0.0.0.0 --port 9000"
