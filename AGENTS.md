# AGENTS.md — Gemini Web Wrapper

Canonical agent guidance for this repository. `AGENTS.md` is the fuller source for assistant-facing instructions. `.github/copilot-instructions.md` must stay short and aligned with this file, and `CLAUDE.md` must remain a symlink to `AGENTS.md`.

## Repository Snapshot

This is a mixed Bun + uv monorepo.

- **Frontend:** `apps/web`
  - React 19 + TypeScript + Vite 8 PWA
  - Shared client state in `src/store.ts` via Zustand
  - API clients and non-trivial browser logic belong in `src/services/`
  - Linting uses `oxlint` and `biome`
- **Backend:** `apps/api`
  - FastAPI app in `src/affine/api/server.py`
  - Module entrypoint in `src/affine/api/__main__.py`
  - Current HTTP routes include `/health`, `/v1/models`, and `/v1/chat/completions`
- **Indexing package:** `packages/code-index`
  - Core modules live in `src/affine/code_index/`
  - Provides parsing, chunking, discovery, embedding, and search helpers used by the workspace
- **Shared Python packages:**
  - `packages/config` — typed settings
  - `packages/llm-core` — provider interfaces and provider factory
  - `packages/shared/python` — shared models and OpenAI-style schemas
  - `packages/code-index` — repository indexing and code search primitives

## Source of Truth Order

When docs or comments disagree, trust sources in this order:

1. Current code in `apps/` and `packages/`
2. `.github/workflows/ci.yml`
3. `README.md`
4. Planning docs under `docs/`

Do not copy aspirational architecture into agent guidance unless the code and CI already match it.

## Working Rules

- Keep edits focused, local, and reversible.
- Prefer fixing the real source over adding compatibility layers.
- Use the repository package managers only: `bun` for JS and TS, `uv` for Python.
- Follow the existing file layout instead of introducing parallel patterns.
- Update docs only when directly affected by the change.
- Do not make unrelated cleanup edits while touching guidance files.

## Frontend Guidance

- Keep React components typed and functional.
- Keep rendering concerns in components; move API calls, adapters, and substantial logic into `apps/web/src/services/`.
- Use Zustand for shared app state instead of creating ad hoc global patterns.
- Preserve strict TypeScript expectations; avoid `any` unless there is no practical alternative.
- Frontend validation should match current CI and package scripts.

## Backend Guidance

- Keep FastAPI handlers async-first.
- Route settings access through `packages/config/src/affine/config/settings.py`.
- Route provider selection through `packages/llm-core/src/affine/llm_core/factory.py`.
- Keep shared request and response schemas in `packages/shared/python/src/affine/shared/`.
- Prefer explicit errors and clear control flow over deep nesting.
- Add or update tests when backend behavior changes.

## Validation Commands

Use app-scoped commands that reflect current CI.

### Frontend (`apps/web`)

```bash
cd apps/web
bun install
bun run lint
bun run typecheck
bun run build
```

Notes:
- `bun run test` exists but currently prints `No tests configured` and exits successfully.
- CI does **not** currently run frontend tests.

### API (`apps/api`)

```bash
cd apps/api
uv sync --all-extras
export PYTHONPATH=src:../../packages/config/src
uv run ruff format --check
uv run ruff check
uv run pyrefly check
uv run pytest
```

### Shared packages

```bash
cd packages/config
uv sync
uv run ruff format --check src/
uv run ruff check src/

cd packages/shared/python
uv sync
uv run ruff format --check src/
uv run ruff check src/
```

## Common Local Commands

### Run the API

```bash
cd apps/api
PYTHONPATH=src:../../packages/config/src uv run uvicorn affine.api.server:app --reload
```

### Run the web app

```bash
cd apps/web
bun run dev
```

## Agent Facing File Rules

- Keep `AGENTS.md` as the canonical, fuller instruction file.
- Keep `.github/copilot-instructions.md` short, high-signal, and consistent with this file.
- Keep `CLAUDE.md` as a symlink to `AGENTS.md`.
- If runtime behavior or validation changes, update this file and the short Copilot mirror together.

## Practical Constraints

- One web app lives in `apps/web`.
- One API app lives in `apps/api`.
- Frontend code must not embed provider secrets or call provider SDKs directly.
- Prefer shared schemas and typed settings over duplicating request or response shapes.
- Treat README feature claims as secondary to the actual codebase when they diverge.
