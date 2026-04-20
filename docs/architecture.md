# Architecture

This document describes the **current** repository structure and runtime behavior.

## Repository layout

```text
.
├── apps/
│   ├── api/                   # FastAPI gateway and indexing routes
│   └── web/                   # React 19 + TypeScript + Vite 8 PWA
├── docs/                      # Project documentation
├── packages/
│   ├── code-index/            # Local indexing + semantic search helpers
│   ├── config/                # Typed settings and cached get_settings()
│   ├── helixent/              # TypeScript ReAct-style agent package
│   ├── llm-core/              # Provider interfaces and implementations
│   └── shared/python/         # Shared Python schemas
├── .github/workflows/         # CI, tests, release, and automation
├── mise.toml                  # Pinned Node/Bun/Python toolchain
├── package.json               # Root workspace shortcuts
└── pyproject.toml             # uv workspace definition
```

## Frontend architecture (`apps/web`)

### Shell

- React 19 + TypeScript application bundled with Vite 8
- Progressive Web App support via `vite-plugin-pwa`
- Shared application state in `src/store.ts`
- Service modules in `src/services/` for API access, storage, provider metadata, repo indexing, shell sessions, and agent streaming

### Primary application modes

The frontend currently routes between these modes:

| Mode | Purpose |
| --- | --- |
| `chat` | OpenAI-compatible chat UI |
| `agent` | SSE-driven agent chat UI |
| `shell` | WebSocket shell sessions, Ghostty rendering, and `webassembly.sh` fallback |
| `editor` | File editing and review |
| `tool` | GitHub browsing plus repo index status and search |
| `settings` | Provider, GitHub, and gateway configuration |

### Frontend configuration flow

- The Settings view manages the selected provider, model, gateway key, GitHub repo, and GitHub token.
- Sensitive values are persisted in `sessionStorage`.
- Sanitized non-sensitive settings can optionally be remembered in `localStorage`.
- Built-in providers are defined in `apps/web/src/services/providers.ts`.
- Users can add custom OpenAI-compatible providers by supplying a provider ID and base URL.

## Backend architecture (`apps/api`)

### API surface

The FastAPI app in `apps/api/src/affine/api/server.py` mounts these active routes:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health probe |
| `GET` | `/v1/models` | Returns the built-in model catalog |
| `POST` | `/v1/chat/completions` | OpenAI-compatible chat completions |
| `POST` | `/v1/agent/chat` | Agent streaming over SSE |
| `POST` | `/v1/repo/index` | GitHub repository indexing |
| `GET` | `/v1/repo/index/status` | Repo index status lookup |
| `POST` | `/v1/repo/search` | Search the stored repo index |
| `POST` | `/v1/local-index/index` | Build a local semantic index |
| `POST` | `/v1/local-index/search` | Search the local semantic index |
| `GET` | `/v1/local-index/stats` | Local index statistics |

### Authentication model

- `GET /health` is public.
- `/v1/*` endpoints are protected only when `API_KEY` is configured.
- If `API_KEY` is unset, the gateway operates in open mode and clients can authenticate only with provider-specific keys supplied in the request.

### Provider selection

Provider settings live in `packages/config/src/affine/config/settings.py`.

The server supports:

- **Built-in providers:** `gemini`, `anthropic`, `copilot`
- **Gateway presets through shared OpenAI-compatible transport:** `opencode-zen`, `kilo-gateway`
- **Request-level custom providers:** any provider name with `x_provider_base_url`

`packages/llm-core/src/affine/llm_core/factory.py` returns:

- a native provider implementation for registered providers, or
- `OpenAICompatibleProvider` when an unknown provider is supplied with a `base_url`

### Chat flow

1. The client calls `/v1/chat/completions` or `/v1/agent/chat`.
2. The server resolves provider overrides from the request body.
3. If no override is usable, the server falls back to the configured provider in `Settings`.
4. The selected provider generates a response or SSE stream.
5. Agent streams and chat streams both close provider resources explicitly.

## Indexing subsystems

### GitHub repository index

The GitHub repo index API lives in:

- `apps/api/src/affine/api/repo_index.py`
- `apps/api/src/affine/api/repo_indexing.py`

Characteristics:

- indexes repository trees fetched through the GitHub API,
- stores index metadata in `REPO_INDEX_DB_PATH` (default `.cache/repo-index.db`),
- extracts language-aware symbols and snippets,
- records available Bash/Python/Rust language servers, and
- optionally syncs to Turso when `REPO_INDEX_TURSO_SYNC_URL` is configured.

### Local semantic index

The local index API lives in `apps/api/src/affine/api/local_index.py` and delegates to `packages/code-index`.

Characteristics:

- indexes a local workspace rooted at the requested path,
- stores embeddings and records in a LanceDB directory under `.cache/lancedb`,
- exposes index, search, and stats endpoints, and
- uses the configured embedder factory from `apps/api/src/affine/api/utils.py`.

## Shared packages

| Package | Responsibility |
| --- | --- |
| `packages/config` | typed settings, provider defaults, repo index config |
| `packages/llm-core` | provider protocol, Gemini/Anthropic/Copilot implementations, OpenAI-compatible fallback |
| `packages/shared/python` | chat, agent, and repo-index request/response schemas |
| `packages/code-index` | local code indexing, AST extraction, storage, and search |
| `packages/helixent` | TypeScript agent-loop package for ongoing agent work |

## Tooling and validation

### Workspace toolchain

- Node.js `24.15.0`
- Bun `1.3.13`
- Python `3.14.4`
- `uv`

### CI workflows

- `ci.yml`
  - frontend lint/typecheck/build
  - API format/lint/typecheck/test
  - config package format/lint
  - shared package format/lint
- `test.yml`
  - frontend `bun run test`
- `release.yml`
  - frontend test/lint/typecheck/build on `v*` tags, then packages `apps/web/dist`

### Verified commands

```bash
# Frontend
cd apps/web
bun install
bun run test
bun run lint
bun run typecheck
bun run build

# API
cd apps/api
uv sync --all-extras
export PYTHONPATH=src:../../packages/config/src
uv run ruff format --check
uv run ruff check
uv run pyrefly check
uv run pytest
```
