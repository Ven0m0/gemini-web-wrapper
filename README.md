# Gemini Web Wrapper

[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
![GitHub repo size](https://img.shields.io/github/repo-size/Ven0m0/gemini-web-wrapper)

A Bun + FFastAPImonorepo for running a mobile-friendly AI workspace in the browser, backed by a configurable LLM gateway and repository indexing APIs.

## What is in the repo

- **`apps/web`** — React 19 + TypeScript + Vite 8 PWA with Chat, Agent, Shell, Editor, Files, and Settings views
- **`apps/api`** — FastAPI gateway exposing OpenAI-compatible chat, agent streaming, GitHub repo indexing, and local code indexing APIs
- **`packages/config`** — typed runtime settings and cached `get_settings()`
- **`packages/llm-core`** — provider abstractions and the provider factory
- **`packages/shared/python`** — shared request and response schemas
- **`packages/code-index`** — local code indexing and semantic search helpers
- **`packages/helixent`** — TypeScript agent-loop package used for ongoing agent work

## Current capabilities

- **Built-in providers:** Google Gemini, Anthropic Claude, GitHub Copilot, OpenCode Zen, and Kilo Gateway
- **Custom providers:** request-level OpenAI-compatible backends via `x_provider` + `x_provider_base_url`
- **Agent streaming:** SSE-based `/v1/agent/chat` for tool-aware agent conversations
- **Repo indexing:** GitHub-backed symbol extraction and search through `/v1/repo/*`
- **Local code indexing:** semantic search over a local workspace through `/v1/local-index/*`
- **PWA frontend:** installable interface with repo browsing, editing, multi-pane shell sessions, and provider configuration
- **Gateway auth modes:** optional server API key protection for `/v1/*` endpoints

## Quick start

### Prerequisites

- Node.js **24.15.0**
- Bun **1.3.13**
- Python **3.14.4**
- `uv`
- Git
- Optional: [mise](https://mise.jdx.dev/) to install the pinned toolchain from `mise.toml`

### 1. Clone and configure

```bash
git clone https://github.com/Ven0m0/gemini-web-wrapper.git
cd gemini-web-wrapper
mise install   # optional but recommended
cp .env.example .env
```

Edit `.env` and set the provider credentials you want to use. For the default Gemini setup you only need `GOOGLE_API_KEY`.

### 2. Install dependencies

```bash
cd apps/web
bun install

cd ../api
uv sync --all-extras
```

### 3. Start the API and web app

```bash
# Terminal 1
cd apps/api
PYTHONPATH=src:../../packages/config/src uv run uvicorn affine.api.server:app --reload --host 0.0.0.0 --port 9000

# Terminal 2
cd apps/web
bun run dev
```

Open:

- **Frontend UI:** `http://localhost:5173`
- **Backend API:** `http://localhost:9000`

During local development, Vite proxies `/v1/*` and `/api/*` requests to the API server.

## Configuration

### Server authentication

The API gateway supports two modes:

- **Open mode** — leave `API_KEY` unset and clients can call `/v1/*` without a bearer token
- **Protected mode** — set `API_KEY` and clients must send `Authorization: Bearer <API_KEY>`

The frontend stores this value in the **Server API Key** field in Settings.

### Built-in provider settings

| Provider | Required key | Default base URL | Default model |
| --- | --- | --- | --- |
| Gemini | `GOOGLE_API_KEY` | Google Gemini API | `gemini-3.1-pro-preview` |
| Anthropic | `ANTHROPIC_API_KEY` | Anthropic API | `claude-sonnet-4-6` |
| Copilot | `COPILOT_API_KEY` | `https://api.githubcopilot.com` | `claude-sonnet-4.6` |
| OpenCode Zen | `OPENCODE_API_KEY` | `http://localhost:4096/zen/v1` | `opencode/glm-5.1` |
| Kilo Gateway | `KILO_API_KEY` | `https://api.kilo.ai/api/gateway` | `kilo-auto/balanced` |

### Repo indexing settings

The API also supports GitHub repo indexing and optional Turso sync:

- `REPO_INDEX_ENABLED`
- `REPO_INDEX_DB_PATH`
- `REPO_INDEX_TURSO_SYNC_URL`
- `REPO_INDEX_TURSO_AUTH_TOKEN`
- `REPO_INDEX_MAX_FILES`
- `REPO_INDEX_MAX_FILE_BYTES`
- `REPO_INDEX_BASH_LSP_COMMAND`
- `REPO_INDEX_PYTHON_LSP_COMMAND`
- `REPO_INDEX_RUST_LSP_COMMAND`

See `.env.example` for a complete template.

## API surface

### Public endpoint

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health probe |

### Gateway endpoints

These endpoints require `Authorization: Bearer <API_KEY>` when `API_KEY` is configured.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/v1/models` | Returns the built-in model catalog |
| `POST` | `/v1/chat/completions` | OpenAI-compatible chat completions with optional streaming |
| `POST` | `/v1/agent/chat` | Streams agent events over SSE |
| `POST` | `/v1/repo/index` | Indexes a GitHub repository using a GitHub token |
| `GET` | `/v1/repo/index/status` | Returns indexing status for a GitHub repo |
| `POST` | `/v1/repo/search` | Searches the stored GitHub repo index |
| `POST` | `/v1/local-index/index` | Builds a local semantic index |
| `POST` | `/v1/local-index/search` | Searches the local semantic index |
| `GET` | `/v1/local-index/stats` | Returns local index statistics |

## Frontend workflow

The web app currently exposes these primary modes:

- **Chat** — OpenAI-compatible chat UI with provider overrides and JSON healing helpers
- **Agent** — SSE-driven agent session UI backed by `/v1/agent/chat`
- **Shell** — saved WebSocket shell profiles, multi-pane layouts, Ghostty rendering, and a `webassembly.sh` fallback
- **Editor** — code editing and review UI
- **Files** — GitHub file browser plus repo index status and symbol search
- **Settings** — GitHub token, gateway key, provider, and model management

The Settings screen stores non-sensitive config in `localStorage` and session-only credentials in `sessionStorage`.

## Development and validation

### Frontend

```bash
cd apps/web
bun install
bun run test
bun run lint
bun run typecheck
bun run build
```

### API

```bash
cd apps/api
uv sync --all-extras
export PYTHONPATH=src:../../packages/config/src
uv run ruff format --check
uv run ruff check
uv run pyrefly check
uv run pytest
```

### Root workspace shortcuts

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

## Deployment

- Frontend targets are documented in [`docs/deployment.md`](docs/deployment.md)
- The release workflow publishes a built frontend tarball when you push a `v*` tag
- The repo also includes `netlify.toml` for static frontend deployments

## Additional docs

- [`docs/architecture.md`](docs/architecture.md) — current repository architecture
- [`docs/runtime-modes.md`](docs/runtime-modes.md) — current runtime surfaces and frontend application modes
- [`docs/deployment.md`](docs/deployment.md) — deployment and environment reference

## License

MIT — see [`LICENSE`](LICENSE).
