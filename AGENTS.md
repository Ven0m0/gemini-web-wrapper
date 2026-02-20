# AGENTS.md — Gemini Web Wrapper

Canonical agent and contributor reference. `CLAUDE.md` and `GEMINI.md` are symlinks to this file.

---

<project-overview>

**Gemini Web Wrapper** is a high-performance, multi-provider LLM gateway with an OpenAI-compatible API surface and a Progressive Web App (PWA) frontend. It wraps Google Gemini (and other providers) behind a standard HTTP/SSE interface, enabling drop-in use with OpenAI-compatible clients.

**Core design decisions:**
- Cookie authentication — no API key required for the `gemini-webapi` path
- Dual Gemini backend: `google-genai` (API key) and `gemini-webapi` (browser cookies)
- OpenAI-compatible `/v1/chat/completions` — drop-in replacement for OpenAI clients
- Stateless server — client maintains conversation history; server is stateless per-request
- Async-first — `async`/`await` throughout; blocking I/O dispatched to thread pools
- Validate at system boundaries only; trust internal code

</project-overview>

---

<stack>

| Layer | Technology |
|---|---|
| Backend language | Python 3.10+ |
| Backend framework | FastAPI + Uvicorn (uvloop) |
| Serialization | orjson, Pydantic v2 |
| LLM providers | Google Gemini (`google-genai`, `gemini-webapi`), Anthropic, GitHub Copilot, Bifrost gateway |
| Cookie extraction | rookiepy |
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

</stack>

---

<repo-structure>

```
/
├── server.py                    # Main FastAPI application entry point
├── config.py                    # Pydantic Settings (env vars)
├── lifespan.py                  # FastAPI lifespan (startup/shutdown)
├── dependencies.py              # FastAPI dependency injection
├── models.py                    # Shared Pydantic models
├── openai_schemas.py            # OpenAI-compatible Pydantic schemas
├── openai_transforms.py         # Message format transformations
├── message_transforms.py        # Additional message helpers
├── response_builder.py          # SSE / response construction helpers
├── tool_parsing.py              # Tool-call parsing utilities
├── state.py                     # Global application state
├── cookie_manager.py            # Multi-profile cookie persistence (aiosqlite)
├── session_manager.py           # Conversation history management
├── gemini_client.py             # gemini-webapi client wrapper
├── github_service.py            # GitHub REST API integration
├── utils.py                     # Shared utilities and error handling
│
├── endpoints/                   # FastAPI router modules (one concern per file)
│   ├── chat.py                  # /chat and /chatbot routes
│   ├── openai.py                # /v1/chat/completions (OpenAI-compat, SSE)
│   ├── gemini.py                # Gemini-specific routes
│   ├── github.py                # /github/* file/PR management routes
│   ├── openwebui.py             # Open WebUI integration routes
│   ├── profiles.py              # Cookie profile management routes
│   └── sessions.py              # Session management routes
│
├── llm_core/                    # Provider abstraction layer
│   ├── interfaces.py            # LLMProvider Protocol definition
│   ├── factory.py               # ProviderFactory (pattern-match dispatch)
│   └── providers/
│       ├── gemini.py            # Google Gemini (google-genai)
│       ├── anthropic.py         # Anthropic Claude
│       ├── copilot.py           # GitHub Copilot
│       └── bifrost.py           # Bifrost AI gateway (OpenAI-compat)
│
├── frontend/                    # React PWA
│   ├── src/
│   │   ├── App.tsx              # Root component
│   │   ├── store.ts             # Zustand global state
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
├── test_server.py               # API endpoint integration tests
├── test_cookie_manager.py       # Cookie manager unit tests
├── test_session_manager.py      # Session manager unit tests
├── test_bifrost.py              # Bifrost provider tests
├── test_github_integration.py   # GitHub service tests
├── test_utils.py                # Utility function tests
│
├── pyproject.toml               # Python project metadata, Ruff config
├── .env.example                 # Required environment variables (template)
├── docker-compose.yml           # Full-stack + Bifrost compose
├── .github/workflows/           # CI/CD (lint, release, dependabot)
├── CLAUDE.md -> AGENTS.md       # Symlink
└── GEMINI.md  -> AGENTS.md      # Symlink
```

</repo-structure>

---

<setup>

### Prerequisites

- Python 3.10+ and [`uv`](https://docs.astral.sh/uv/)
- Node.js 18+ and npm
- A Google API key (Gemini) or another supported provider key

### Install

```bash
git clone <repo-url> && cd gemini-web-wrapper
cp .env.example .env   # set at minimum: GOOGLE_API_KEY
uv sync                # Python deps from uv.lock
cd frontend && npm install && cd ..
```

</setup>

---

<dev-commands>

```bash
# Backend — dev (hot-reload)
uv run uvicorn server:app --reload --host 0.0.0.0 --port 9000

# Frontend — dev (hot-reload, proxies API to backend)
cd frontend && npm run dev       # http://localhost:5173

# Full stack — production build
cd frontend && npm run build && cd ..
uv run uvicorn server:app --host 0.0.0.0 --port 9000
# Frontend served at http://localhost:9000/

# Docker
docker-compose up bifrost                # Bifrost gateway only
docker-compose --profile full-stack up  # Bifrost + app
```

</dev-commands>

---

<code-quality>

Run in this order before every commit:

```bash
uv run ruff format .          # 1. Format
pyrefly check                 # 2. Type check
uv run ruff check . --fix     # 3. Lint (auto-fix)
uv run pytest                 # 4. Tests
```

Frontend:

```bash
cd frontend && npm run build  # Catches TypeScript errors
```

### Running tests

```bash
uv run pytest                  # All tests
uv run pytest -v               # Verbose
uv run pytest test_server.py   # Specific file
uv run pytest -k test_health   # Name filter
```

- Async tests use **anyio** (not asyncio directly).
- Frontend has no automated test suite; use browser console and Network tab.

</code-quality>

---

<conventions>

### Python

| Topic | Rule |
|---|---|
| Naming | `snake_case` functions/vars, `PascalCase` classes, `UPPER_SNAKE_CASE` constants |
| Line length | 88 characters (Ruff enforced) |
| Type hints | Required on all public and private functions |
| Docstrings | Required on all public API functions/classes |
| Strings | f-strings for formatting |
| Async | `async`/`await` for all I/O; blocking ops in `asyncio.to_thread` or thread pool |
| Error handling | Validate at system boundaries only; trust internal code |
| Early returns | Preferred over nested conditionals |
| DRY | Extract shared logic to `utils.py`; no copy-paste |

### TypeScript / React

| Topic | Rule |
|---|---|
| Components | Functional with typed props interfaces |
| Naming | `PascalCase` components, `camelCase` functions/vars, `handle` prefix for event handlers |
| State | Local: `useState`/`useReducer`; Global: Zustand store (`store.ts`) |
| API calls | In `src/services/` only — never inline in components |
| TypeScript | Strict mode; no `any` without justification |
| No prop drilling | Use Zustand store or React context for shared state |

### File size limits

| Scope | Limit |
|---|---|
| Provider files (`llm_core/providers/`) | 300 lines |
| Frontend components | 500 lines |
| Frontend services | 400 lines |

Split a file when it significantly exceeds its limit.

### Git

- Never commit to `main` — always use a feature branch.
- Branch naming: `feat/short-desc`, `fix/short-desc`, `chore/short-desc`
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) — `feat(scope): description`
- One logical change per commit; open draft PRs early for visibility.
- Squash only when merging to `main`.

</conventions>

---

<architecture>

### Provider pattern

`LLMProvider` Protocol defined in `llm_core/interfaces.py`. Providers registered in `ProviderFactory` (`llm_core/factory.py`) via structural `match` dispatch. To add a provider: implement the Protocol, add a `case` branch in the factory, add required env vars.

### Endpoint modules

Each domain concern lives in its own router file under `endpoints/`. All routers mounted in `server.py`. New endpoints go in the matching domain file; create a new file only for genuinely new domains.

### Configuration

All env vars flow through Pydantic `Settings` in `config.py`. Never read `os.environ` directly in business logic.

### OpenAI compatibility

Model aliasing in `openai_transforms.py` maps OpenAI model names to provider-specific ones:

| OpenAI alias | Resolved model |
|---|---|
| `gpt-4o-mini` | `gemini-2.5-flash` |
| `gpt-4o` | `gemini-2.5-pro` |
| `gpt-4.1-mini` | `gemini-3.0-pro` |
| `claude-3-5-sonnet` | `claude-3-5-sonnet-20241022` |

</architecture>

---

<common-tasks>

### Add a new LLM provider

1. Create `llm_core/providers/<name>.py` implementing `LLMProvider` Protocol.
2. Add the provider type literal to `ProviderType` in `llm_core/factory.py`.
3. Add a `case "<name>":` branch in `ProviderFactory.create`.
4. Add required env vars to `.env.example` and `config.py`.
5. Write tests in `test_<name>.py`.

### Add a new API endpoint

1. Find or create the router file in `endpoints/` for the domain.
2. Implement the handler with full type annotations and a docstring.
3. Mount the router in `server.py` if it is new.
4. Add integration tests to the appropriate test file.
5. Run the full quality gate before committing.

### Add a Python package

```bash
uv add <package>          # Runtime dependency
uv add --dev <package>    # Dev/test-only dependency
# Never use pip install
```

### Add a frontend component

1. Create `frontend/src/components/MyComponent.tsx` with a typed props interface.
2. Keep render logic in the component; move API/business logic to `src/services/`.
3. Global state → Zustand store.
4. `cd frontend && npm run build` to verify.

### Run type checking

```bash
pyrefly check                    # Python (fix all errors before committing)
cd frontend && npx tsc --noEmit  # TypeScript
```

</common-tasks>

---

<dependencies>

### Python (backend)

| Package | Role |
|---|---|
| `fastapi` | HTTP framework and router |
| `uvicorn[standard]` | ASGI server with uvloop |
| `pydantic` v2 | Request/response validation and settings |
| `orjson` | Fast JSON serialization — default response class and hot-path parsing |
| `httpx` | Async HTTP client (GitHub API, provider calls) |
| `google-genai` | Google Gemini SDK (API-key path) |
| `gemini-webapi` | Gemini web interface (cookie-auth path) |
| `rookiepy` | Browser cookie extraction for gemini-webapi |
| `anthropic` | Anthropic Claude SDK |
| `openai` | OpenAI SDK (also used for Bifrost gateway) |
| `aiosqlite` | Async SQLite for cookie profiles and sessions |
| `cachetools` | TTLCache for in-memory session caching |
| `json-repair` | Robust JSON parsing for malformed LLM tool-call output |
| `python-multipart` | Form/multipart handling for FastAPI |
| `pytest` + `anyio` | Testing — async tests use anyio, not asyncio |
| `ruff` | Linting and formatting |
| `pyrefly` | Static type checking |

### JavaScript (frontend)

| Package | Role |
|---|---|
| `react` 19 | UI framework |
| `zustand` 5 | Lightweight global state — no Redux |
| `@uiw/react-codemirror` | React wrapper for CodeMirror editor |
| `@codemirror/*` | Editor core, language support, themes |
| `diff` | Text diff computation for change visualization |
| `vite` 7 | Build tool and dev server |
| `vite-plugin-pwa` | PWA service worker and manifest generation |
| `typescript` 5 | Static typing |

</dependencies>

---

<environment>

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

</environment>

---

<ci-cd>

| Workflow | Trigger | Actions |
|---|---|---|
| `lint.yml` | Push/PR to `main` | `ruff format --check`, `ruff check` |
| `release.yml` | Push `v*` tag | `uv build`, create GitHub Release |
| `dependabot-automerge.yml` | Dependabot PRs | Auto-merge patch/minor updates |
| `jules-*.yml` | Scheduled | Performance analysis / cleanup agents |

To release: `git tag v1.2.3 && git push origin v1.2.3`

</ci-cd>
