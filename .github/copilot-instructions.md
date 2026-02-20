---
applyTo: "**"
---

# Gemini Web Wrapper — Copilot Instructions

Multi-provider LLM gateway with an OpenAI-compatible API and a React PWA frontend.

## Stack

- **Backend**: Python 3.10+, FastAPI, Uvicorn (uvloop), Pydantic v2, orjson
- **Frontend**: TypeScript 5, React 19, Vite 7, Zustand 5, CodeMirror 6
- **Package managers**: `uv` (Python — never pip), `bun` (JS)
- **Linting**: Ruff (Python), ESLint (TypeScript)
- **Type checking**: pyrefly (Python), tsc (TypeScript)
- **Tests**: pytest + anyio (Python); no automated frontend test suite

## Key Principles

- **Stateless server** — client owns conversation history; server is stateless per-request.
- **Async-first** — `async`/`await` for all I/O; blocking ops go in `asyncio.to_thread`.
- **Validate at boundaries only** — trust internal code; only validate user input and external API responses.
- **OpenAI-compatible** — `/v1/chat/completions` is a drop-in for OpenAI clients; model aliases map OpenAI names to provider models.
- **Provider pattern** — all LLM providers implement the `LLMProvider` Protocol (`llm_core/interfaces.py`) and are registered in `ProviderFactory`.

## Python Conventions

- `snake_case` functions/vars, `PascalCase` classes, `UPPER_SNAKE_CASE` constants
- 88-char line limit (Ruff enforced)
- Type hints required on all functions (public and private)
- Docstrings required on all public API functions and classes
- f-strings for string formatting
- Early returns preferred over nested conditionals
- No `os.environ` reads in business logic — all config via Pydantic `Settings` in `config.py`
- Shared helpers go in `utils.py`; no copy-paste logic

## TypeScript / React Conventions

- Functional components with typed props interfaces
- `PascalCase` components, `camelCase` functions/vars, `handle` prefix for event handlers
- Local state: `useState` / `useReducer`; global state: Zustand (`store.ts`)
- API and business logic in `src/services/` only — never inline in components
- Strict mode; no `any` without justification
- No prop drilling — use Zustand or React context

## File Size Limits

| Scope | Limit |
|---|---|
| `llm_core/providers/*.py` | 300 lines |
| Frontend components | 500 lines |
| Frontend services | 400 lines |

## Quality Gate (run before every commit)

```bash
# Python
uv run ruff format .
pyrefly check
uv run ruff check . --fix
uv run pytest

# Frontend
cd frontend && bun run build
```

## Package Management

```bash
# Python — never use pip
uv add <package>           # runtime dep
uv add --dev <package>     # dev/test dep

# JavaScript — never use npm or pnpm
cd frontend && bun add <package>
cd frontend && bun add -d <package>
```

## Common Patterns

### Add a provider

1. `llm_core/providers/<name>.py` implementing `LLMProvider` Protocol
2. Add literal to `ProviderType` in `llm_core/factory.py`
3. Add `case "<name>":` in `ProviderFactory.create`
4. Add env vars to `.env.example` and `config.py`
5. Write tests in `test_<name>.py`

### Add an endpoint

1. Add handler to the relevant file in `endpoints/` (or create one for a new domain)
2. Full type annotations + docstring required
3. Mount router in `server.py` if new
4. Add integration tests

### Add a frontend component

1. `frontend/src/components/MyComponent.tsx` with typed props interface
2. Render logic in the component; business/API logic in `src/services/`
3. Run `cd frontend && bun run build` to verify

## Environment Variables

| Variable | Required | Default |
|---|---|---|
| `GOOGLE_API_KEY` | Yes (Gemini) | — |
| `ANTHROPIC_API_KEY` | Yes (Anthropic) | — |
| `GITHUB_TOKEN` | Yes (Copilot) | — |
| `MODEL_PROVIDER` | No | `gemini` |
| `MODEL_NAME` | No | provider default |
| `BIFROST_URL` | No | `http://localhost:8080/v1` |
| `PORT` | No | `9000` |

## Key Dependencies

| Package | Purpose |
|---|---|
| `google-genai` | Gemini SDK (API-key path) |
| `gemini-webapi` | Gemini web interface (cookie-auth path) |
| `rookiepy` | Browser cookie extraction |
| `anthropic` | Anthropic Claude SDK |
| `openai` | OpenAI SDK / Bifrost gateway |
| `aiosqlite` | Async SQLite (cookies, sessions) |
| `orjson` | Fast JSON — use in hot paths instead of `json` |
| `json-repair` | Robust parsing of malformed LLM tool-call JSON |
