# AGENTS.md — Gemini Web Wrapper

Canonical reference for AI agents and contributors working on this repository.
`CLAUDE.md` and `GEMINI.md` are symlinks that point here.

---

## Project Overview

**Gemini Web Wrapper** is a high-performance, multi-provider LLM gateway with an OpenAI-compatible API surface and a Progressive Web App (PWA) frontend. It wraps Google Gemini (and other providers) behind a standard HTTP/SSE interface, enabling drop-in use with OpenAI-compatible clients.

### Stack

| Layer | Technology |
|---|---|
| Backend language | Python 3.10+ |
| Backend framework | FastAPI + Uvicorn (uvloop) |
| Serialization | orjson, Pydantic v2 |
| LLM providers | Google Gemini (`google-genai`, `gemini-webapi`), Anthropic, GitHub Copilot, Bifrost gateway |
| Database | aiosqlite (cookie/session storage) |
| Frontend language | TypeScript 5+ |
| Frontend framework | React 19 |
| Frontend build | Vite 7 + vite-plugin-pwa |
| Code editor component | CodeMirror 6 + `@uiw/react-codemirror` |
| State management | Zustand 5 |
| Package manager (Python) | `uv` (never pip) |
| Package manager (JS) | npm |
| Linter / formatter | Ruff (Python), ESLint (TS/JS) |
| Type checker | pyrefly (Python), tsc (TypeScript) |
| Test framework | pytest + anyio |
| CI | GitHub Actions |
| Containerization | Docker / docker-compose |

---

## Repo Structure

```
/
├── @server.py                   # Main FastAPI application entry point
├── @config.py                   # Pydantic Settings (env vars)
├── @lifespan.py                 # FastAPI lifespan (startup/shutdown)
├── @dependencies.py             # FastAPI dependency injection
├── @models.py                   # Shared Pydantic models
├── @openai_schemas.py           # OpenAI-compatible Pydantic schemas
├── @openai_transforms.py        # Message format transformations
├── @message_transforms.py       # Additional message helpers
├── @response_builder.py         # SSE / response construction helpers
├── @tool_parsing.py             # Tool-call parsing utilities
├── @state.py                    # Global application state
├── @cookie_manager.py           # Multi-profile cookie persistence (aiosqlite)
├── @session_manager.py          # Conversation history management
├── @gemini_client.py            # gemini-webapi client wrapper
├── @github_service.py           # GitHub REST API integration
├── @utils.py                    # Shared utilities and error handling
│
├── @endpoints/                  # FastAPI router modules (one concern per file)
│   ├── chat.py                  # /chat and /chatbot routes
│   ├── openai.py                # /v1/chat/completions (OpenAI-compat, SSE)
│   ├── gemini.py                # Gemini-specific routes
│   ├── github.py                # /github/* file/PR management routes
│   ├── openwebui.py             # Open WebUI integration routes
│   ├── profiles.py              # Cookie profile management routes
│   └── sessions.py              # Session management routes
│
├── @llm_core/                   # Provider abstraction layer
│   ├── interfaces.py            # LLMProvider Protocol definition
│   ├── factory.py               # ProviderFactory (pattern-match dispatch)
│   └── providers/
│       ├── gemini.py            # Google Gemini (google-genai)
│       ├── anthropic.py         # Anthropic Claude
│       ├── copilot.py           # GitHub Copilot
│       └── bifrost.py           # Bifrost AI gateway (OpenAI-compat)
│
├── @frontend/                   # React PWA
│   ├── src/
│   │   ├── @App.tsx             # Root component
│   │   ├── @store.ts            # Zustand global state
│   │   ├── main.tsx             # Entry point
│   │   ├── components/          # React UI components
│   │   │   ├── CLI.tsx          # Terminal-style chat UI
│   │   │   ├── Editor.tsx       # CodeMirror file editor
│   │   │   ├── ChatWidget.tsx   # Embeddable chat widget
│   │   │   ├── ChatWindow.tsx   # Full chat window
│   │   │   ├── Tool.tsx         # Tool-call display
│   │   │   ├── PythonRunner.tsx # In-browser Python (Pyodide)
│   │   │   └── WebShell.tsx     # Browser shell component
│   │   ├── services/            # Business-logic / API services
│   │   │   ├── ai.ts            # LLM API calls
│   │   │   ├── github.ts        # GitHub REST calls
│   │   │   ├── websocket.ts     # WebSocket client
│   │   │   ├── diff.ts          # Diff utilities
│   │   │   ├── python.ts        # Pyodide integration
│   │   │   ├── wasmer.ts        # WASM runtime
│   │   │   └── version.ts       # Version helpers
│   │   └── codemirror/          # CodeMirror extensions/config
│   ├── public/                  # Static assets, manifest, service worker
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── @test_server.py              # API endpoint integration tests
├── test_cookie_manager.py       # Cookie manager unit tests
├── test_session_manager.py      # Session manager unit tests
├── test_bifrost.py              # Bifrost provider tests
├── test_github_integration.py   # GitHub service tests
├── test_utils.py                # Utility function tests
│
├── @pyproject.toml              # Python project metadata, Ruff/mypy config
├── @.env.example                # Required environment variables (template)
├── docker-compose.yml           # Full-stack + Bifrost compose
├── .github/workflows/           # CI/CD (lint, release, dependabot)
├── CLAUDE.md -> AGENTS.md       # Symlink
└── GEMINI.md  -> AGENTS.md      # Symlink
```

---

## Environment Setup

### 1. Prerequisites

- Python 3.10+ and [`uv`](https://docs.astral.sh/uv/) installed
- Node.js 18+ and npm installed
- A Google API key (Gemini) or another supported provider key

### 2. Clone and configure

```bash
git clone <repo-url> && cd gemini-web-wrapper
cp .env.example .env
# Edit .env and set at minimum: GOOGLE_API_KEY
```

### 3. Install Python dependencies

```bash
uv sync          # Installs all deps from uv.lock
```

### 4. Install frontend dependencies

```bash
cd frontend && npm install && cd ..
```

---

## Dev Workflows

### Run backend (dev)

```bash
uv run uvicorn server:app --reload --host 0.0.0.0 --port 9000
```

API docs available at `http://localhost:9000/docs`.

### Run frontend (dev, hot-reload)

```bash
cd frontend && npm run dev   # http://localhost:5173
```

The Vite dev server proxies API calls to the backend.

### Run full stack (production build)

```bash
cd frontend && npm run build && cd ..
uv run uvicorn server:app --host 0.0.0.0 --port 9000
# Frontend served at http://localhost:9000/
```

### Docker / Bifrost

```bash
docker-compose up bifrost            # Bifrost gateway only
docker-compose --profile full-stack up  # Bifrost + app
```

---

## Build

### Backend

No separate build step needed; `uv sync` resolves dependencies.

To build a distributable wheel:

```bash
uv build
```

### Frontend

```bash
cd frontend && npm run build
# Output: frontend/dist/  (served by FastAPI StaticFiles)
```

---

## Testing

### Backend tests

```bash
uv run pytest                  # All tests
uv run pytest -v               # Verbose
uv run pytest test_server.py   # Specific file
uv run pytest -k test_health   # Name filter
```

- Test framework: **pytest**
- Async tests: **anyio** (not asyncio)
- Cover edge cases, errors, and realistic inputs

### Frontend tests

Manual browser testing. Check the browser console and Network tab. No automated frontend test suite currently exists.

---

## Code Quality Gates

Run these before every commit (in order):

```bash
# 1. Format
uv run ruff format .

# 2. Type check
pyrefly check

# 3. Lint (auto-fix)
uv run ruff check . --fix

# 4. Tests
uv run pytest
```

Frontend:

```bash
cd frontend
npm run build      # Catches TypeScript errors
```

---

## Deploy

Triggered automatically by pushing a `v*` tag:

```bash
git tag v1.2.3 && git push origin v1.2.3
```

The `release.yml` workflow builds the package with `uv build` and creates a GitHub Release with generated notes and dist artifacts.

Manual deploy reference: see `DEPLOYMENT.md` and `deploy.sh`.

---

## Conventions

### Python

| Topic | Convention |
|---|---|
| Naming | `snake_case` functions/variables, `PascalCase` classes, `UPPER_SNAKE_CASE` constants |
| Line length | 88 characters (Ruff enforced) |
| Type hints | Required on all public and private functions |
| Optional types | Explicit `None` checks; never implicit |
| Docstrings | Required on all public API functions/classes |
| Strings | f-strings for formatting |
| Async | `async`/`await` everywhere for I/O; blocking ops in thread pool |
| Error handling | Validate at system boundaries only; trust internal code |
| Early returns | Preferred over nested conditionals |
| DRY | No copy-paste logic; extract shared helpers to `utils.py` |

### TypeScript / React

| Topic | Convention |
|---|---|
| Components | Functional components with typed props interfaces |
| Naming | `PascalCase` components, `camelCase` functions/variables |
| Handlers | Prefix with `handle` (e.g., `handleSubmit`) |
| State | Local: `useState`/`useReducer`; Global: Zustand store (`store.ts`) |
| API calls | Encapsulated in `src/services/` — never inline in components |
| TypeScript | Strict mode enabled; no `any` without justification |
| No prop drilling | Use Zustand store or React context for shared state |

### Architecture Patterns

- **Provider Pattern**: `LLMProvider` Protocol in `llm_core/interfaces.py`; providers registered via `ProviderFactory` with `match` dispatch.
- **Stateless server**: Client maintains conversation history; server is stateless per-request.
- **OpenAI Compatibility**: Model aliasing maps OpenAI model names to provider-specific ones (e.g., `gpt-4o` → `gemini-2.5-pro`).
- **Endpoint modules**: Each concern lives in its own router file under `endpoints/`; all routers mounted in `server.py`.
- **Configuration**: All env vars flow through Pydantic `Settings` in `config.py`; never read `os.environ` directly in business logic.

### File Size Guidelines

| File | Limit |
|---|---|
| `server.py` | No strict limit (main orchestrator) |
| Provider files (`llm_core/providers/`) | < 300 lines |
| Frontend components | < 500 lines |
| Frontend services | < 400 lines |

Split a file when it significantly exceeds these limits.

### Git Workflow

- **Never commit to `main` directly** — always use a feature branch.
- Branch naming: `feat/short-desc`, `fix/short-desc`, `chore/short-desc`
- Commit style: conventional commits — `feat(scope): description`, `fix(scope): description`
- One logical change per commit; open draft PRs early for visibility.
- Squash only when merging to `main`.

---

## Key Dependencies

### Python (backend)

| Package | Purpose |
|---|---|
| `fastapi` | HTTP framework |
| `uvicorn[standard]` | ASGI server (uvloop) |
| `pydantic` v2 | Data validation and settings |
| `orjson` | Fast JSON serialization |
| `httpx` | Async HTTP client |
| `google-genai` | Google Gemini SDK |
| `gemini-webapi` | Gemini web API wrapper |
| `anthropic` | Anthropic Claude SDK |
| `openai` | OpenAI SDK (also used for Bifrost) |
| `aiosqlite` | Async SQLite (cookies/sessions) |
| `cachetools` | TTLCache for in-memory caching |
| `json-repair` | Robust JSON parsing for LLM output |
| `pytest` + `anyio` | Testing |
| `ruff` | Linting and formatting |
| `pyrefly` | Type checking |

### JavaScript (frontend)

| Package | Purpose |
|---|---|
| `react` 19 | UI framework |
| `zustand` 5 | State management |
| `@uiw/react-codemirror` | Code editor component |
| `@codemirror/*` | Editor language support |
| `diff` | Text diff computation |
| `vite` | Build tool |
| `vite-plugin-pwa` | PWA service worker generation |
| `typescript` | Static typing |

---

## Common Tasks

### Add a new LLM provider

1. Create `llm_core/providers/<name>.py` implementing `LLMProvider` Protocol.
2. Add the provider type literal to `ProviderType` in `llm_core/factory.py`.
3. Add a `case "<name>":` branch in `ProviderFactory.create`.
4. Add required env vars to `.env.example` and `config.py`/`Settings`.
5. Write tests in `test_<name>.py`.

### Add a new API endpoint

1. Determine the correct router file in `endpoints/` (or create a new one for a new domain).
2. Implement the route handler with full type annotations and a docstring.
3. Mount the router in `server.py` if it is new.
4. Add integration tests to the appropriate test file.
5. Run the full quality gate before committing.

### Add a new Python package

```bash
uv add <package>          # Runtime dependency
uv add --dev <package>    # Dev/test-only dependency
```

Never use `pip install`.

### Add a new frontend component

1. Create `frontend/src/components/MyComponent.tsx` with a typed props interface.
2. Keep render logic in the component; move API/business logic to `src/services/`.
3. Use Zustand store for state that crosses component boundaries.
4. Build to verify: `cd frontend && npm run build`.

### Run type checking

```bash
pyrefly check              # Python (fix all errors before committing)
cd frontend && npx tsc --noEmit  # TypeScript
```

### Environment variables reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_API_KEY` | Yes (Gemini) | — | Google AI API key |
| `MODEL_PROVIDER` | No | `gemini` | `gemini` \| `anthropic` \| `copilot` \| `bifrost` |
| `MODEL_NAME` | No | provider default | Override model name |
| `ANTHROPIC_API_KEY` | Yes (Anthropic) | — | Anthropic API key |
| `GITHUB_TOKEN` | Yes (Copilot) | — | GitHub personal access token |
| `BIFROST_URL` | No | `http://localhost:8080/v1` | Bifrost gateway base URL |
| `BIFROST_API_KEY` | No | `sk-bifrost-default` | Bifrost API key |
| `PORT` | No | `9000` | Server port |
| `FRONTEND_DIST_DIR` | No | `frontend/dist` | Path to built frontend |
| `DEBUG` | No | `false` | Enable debug logging |
| `LOG_LEVEL` | No | `INFO` | Log verbosity |

### Model aliases (OpenAI compatibility)

| OpenAI alias | Resolved model |
|---|---|
| `gpt-4o-mini` | `gemini-2.5-flash` |
| `gpt-4o` | `gemini-2.5-pro` |
| `gpt-4.1-mini` | `gemini-3.0-pro` |
| `claude-3-5-sonnet` | `claude-3-5-sonnet-20241022` |

---

## CI/CD Pipelines

| Workflow | Trigger | Actions |
|---|---|---|
| `lint.yml` | Push/PR to `main` | `ruff format --check`, `ruff check` |
| `release.yml` | Push `v*` tag | `uv build`, create GitHub Release |
| `dependabot-automerge.yml` | Dependabot PRs | Auto-merge patch/minor updates |
| `jules-*.yml` | Scheduled | Performance analysis / cleanup agents |
