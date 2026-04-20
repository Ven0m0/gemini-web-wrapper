# Deployment Guide

This repository is split into a static frontend (`apps/web`) and a FastAPI backend (`apps/api`). Deploy them together or separately, but keep the frontend configured to talk to the API you expose.

## Pinned toolchain

The repository pins the following versions in `mise.toml` and CI:

- Node.js **24.15.0**
- Bun **1.3.13**
- Python **3.14.4**
- `uv` (latest)

If you use [mise](https://mise.jdx.dev/), run:

```bash
mise install
```

## Environment variables

### Core server settings

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `API_KEY` | No | unset | Enables bearer-token auth for `/v1/*` when set |
| `MODEL_PROVIDER` | No | `gemini` | One of `gemini`, `anthropic`, `copilot`, `opencode-zen`, `kilo-gateway` |
| `MODEL_NAME` | No | provider default | Overrides the default model for the selected provider |
| `HOST` | No | `0.0.0.0` | API bind host |
| `PORT` | No | `9000` | API bind port |
| `FRONTEND_DIST_DIR` | No | `apps/web/dist` | Path to a built frontend bundle |
| `CORS_ALLOW_ORIGINS` | No | empty list | Comma-separated origin allowlist |

### Provider credentials

| Variable | Used by |
| --- | --- |
| `GOOGLE_API_KEY` | Gemini |
| `ANTHROPIC_API_KEY` | Anthropic |
| `COPILOT_API_KEY` | GitHub Copilot |
| `OPENCODE_API_KEY` | OpenCode Zen |
| `KILO_API_KEY` | Kilo Gateway |
| `COPILOT_BASE_URL` | Optional Copilot override |
| `OPENCODE_BASE_URL` | Optional OpenCode Zen override |
| `KILO_BASE_URL` | Optional Kilo override |

### Repo indexing settings

| Variable | Default | Notes |
| --- | --- | --- |
| `REPO_INDEX_ENABLED` | `true` | Enables `/v1/repo/*` |
| `REPO_INDEX_DB_PATH` | `.cache/repo-index.db` | Repo index database path |
| `REPO_INDEX_TURSO_SYNC_URL` | unset | Optional Turso sync URL |
| `REPO_INDEX_TURSO_AUTH_TOKEN` | unset | Optional Turso auth token |
| `REPO_INDEX_MAX_FILES` | `1000` | Per-index file cap |
| `REPO_INDEX_MAX_FILE_BYTES` | `262144` | Max indexed file size |
| `REPO_INDEX_BASH_LSP_COMMAND` | `bash-language-server` | Bash symbol extraction helper |
| `REPO_INDEX_PYTHON_LSP_COMMAND` | `pylsp` | Python symbol extraction helper |
| `REPO_INDEX_RUST_LSP_COMMAND` | `rust-analyzer` | Rust symbol extraction helper |

Copy the template and edit as needed:

```bash
cp .env.example .env
```

## Local development

### Backend

```bash
cd apps/api
uv sync --all-extras
export PYTHONPATH=src:../../packages/config/src
uv run uvicorn affine.api.server:app --reload --host 0.0.0.0 --port 9000
```

### Frontend

```bash
cd apps/web
bun install
bun run dev
```

Local URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:9000`

Vite proxies `/v1/*` and `/api/*` to the API server during development.

## Authentication behavior

- `GET /health` is always public.
- `/v1/*` endpoints are public only when `API_KEY` is unset.
- When `API_KEY` is set, include `Authorization: Bearer $API_KEY` in API requests.
- GitHub repo indexing also requires a GitHub token in the request body so the backend can read repository contents.

Example protected request:

```bash
curl -X POST http://localhost:9000/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-3.1-pro-preview","messages":[{"role":"user","content":"Hello"}]}'
```

## Production validation

Validate before deploying:

```bash
# Frontend
cd apps/web
bun install
bun run test
bun run lint
bun run typecheck
bun run build

# Backend
cd ../api
uv sync --all-extras
export PYTHONPATH=src:../../packages/config/src
uv run ruff format --check
uv run ruff check
uv run pyrefly check
uv run pytest
```

## Deployment targets

### Netlify (frontend)

`netlify.toml` is already configured:

- Build command: `bun install && bun run build`
- Publish directory: `apps/web/dist`

### Vercel (frontend)

Deploy the built frontend from `apps/web`:

- Install command: `bun install`
- Build command: `bun run build`
- Output directory: `dist`

### Render (backend)

- Build command:

  ```bash
  cd apps/api && uv sync --all-extras
  ```

- Start command:

  ```bash
  cd apps/api && PYTHONPATH=src:../../packages/config/src uv run uvicorn affine.api.server:app --host 0.0.0.0 --port $PORT
  ```

Set provider credentials and `API_KEY` in the Render environment as needed.

### Railway (backend)

Use a Python 3.14-compatible base image. Example Dockerfile:

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim
WORKDIR /app
COPY . .
RUN cd apps/api && uv sync --all-extras
ENV PYTHONPATH=apps/api/src:packages/config/src
CMD ["uv", "run", "--directory", "apps/api", "uvicorn", "affine.api.server:app", "--host", "0.0.0.0", "--port", "9000"]
```

### Self-hosted split deployment

A common production setup is:

1. Build and host `apps/web/dist` on a static host such as Netlify, Vercel, nginx, or S3.
2. Run the FastAPI backend separately on Render, Railway, Fly.io, a VM, or Kubernetes.
3. Point the frontend at the API origin with your preferred reverse proxy or frontend environment wiring.

## Release workflow

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which:

1. installs frontend dependencies,
2. runs `bun run test`, `bun run lint`, `bun run typecheck`, and `bun run build`,
3. packages `apps/web/dist`, and
4. publishes a GitHub Release asset.
