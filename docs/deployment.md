# Deployment Guide

Monorepo structure: `apps/web` (React/Vite), `apps/api` (FastAPI), `packages/*` (shared).

## Prerequisites

- **bun** (v1.1+) - JavaScript runtime
- **uv** (v0.5+) - Python package manager
- **git** and **Python 3.10+**

Install:
```bash
curl -fsSL https://bun.sh/install | bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Environment Setup

```bash
cat > apps/api/.env << 'EOF'
GOOGLE_API_KEY=your_google_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
MODEL_PROVIDER=gemini
MODEL_NAME=gemini-2.0-flash-exp
PORT=8000
EOF
```

## Local Development

Backend:
```bash
cd apps/api
uv sync --all-extras
export PYTHONPATH=src:../../packages/config/src
uv run uvicorn affine.api.server:app --reload --port 8000
```

Frontend:
```bash
cd apps/web
bun install
bun run dev
```

## Production Build

Frontend:
```bash
cd apps/web && bun install && bun run build
```
Output: `apps/web/dist/`

Backend:
```bash
cd apps/api && uv sync --all-extras
export PYTHONPATH=src:../../packages/config/src
uv run uvicorn affine.api.server:app --host 0.0.0.0 --port $PORT
```

## Deployment Options

### Frontend - Vercel

Already configured with `vercel.json`. Connect repo or deploy manually:
```bash
cd apps/web && bun install && bun run build
```

**Settings:**
- Build Command: `bun run build`
- Output Directory: `dist`
- Install Command: `bun install`

### Backend - Render

**Build Command:**
```bash
cd apps/api && uv sync --all-extras
```

**Start Command:**
```bash
cd apps/api && PYTHONPATH=src:../../packages/config/src uv run uvicorn affine.api.server:app --host 0.0.0.0 --port $PORT
```

### Backend - Railway

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim
WORKDIR /app
COPY . .
RUN cd apps/api && uv sync --all-extras
ENV PYTHONPATH=apps/api/src:packages/config/src
CMD ["uv", "run", "--directory", "apps/api", "uvicorn", "affine.api.server:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Self-Hosted - Docker Compose

```yaml
version: '3.8'
services:
  api:
    build: .
    ports: ["8000:8000"]
    environment:
      GOOGLE_API_KEY: ${GOOGLE_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      MODEL_PROVIDER: ${MODEL_PROVIDER}
      MODEL_NAME: ${MODEL_NAME}
      PORT: 8000
  web:
    image: nginx:alpine
    ports: ["80:80"]
    volumes:
      - ./apps/web/dist:/usr/share/nginx/html:ro
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_API_KEY` | Yes* | - | Google Gemini API key |
| `ANTHROPIC_API_KEY` | Yes* | - | Anthropic Claude API key |
| `MODEL_PROVIDER` | Yes | `gemini` | `gemini` or `anthropic` |
| `MODEL_NAME` | Yes | `gemini-2.0-flash-exp` | Model identifier |
| `PORT` | No | `8000` | Server port |

*At least one API key required for chosen provider.

## Health Check

```bash
curl https://your-api-url.com/health

curl -X POST https://your-api-url.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-2.0-flash-exp","messages":[{"role":"user","content":"Hello"}]}'
```
