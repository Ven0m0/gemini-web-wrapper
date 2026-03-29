# AGENTS.md — Gemini Web Wrapper

Canonical repository guidance for agentic tools. `CLAUDE.md` must remain a symlink to this file.

## Project Snapshot

Gemini Web Wrapper is a monorepo for a FastAPI backend, a React PWA frontend, and shared Python packages.

- **Frontend:** `/home/runner/work/gemini-web-wrapper/gemini-web-wrapper/apps/web`
  - React 19 + TypeScript + Vite PWA
  - Zustand state in `src/store.ts`
  - Business logic and API clients belong in `src/services/`
- **Backend:** `/home/runner/work/gemini-web-wrapper/gemini-web-wrapper/apps/api`
  - Python FastAPI app in `src/affine/api/server.py`
  - Entrypoint module in `src/affine/api/__main__.py`
  - Current mounted endpoints are implemented directly in `server.py`
- **Shared Python packages:**
  - `packages/config` — typed settings
  - `packages/llm-core` — provider interfaces and factory
  - `packages/shared/python` — shared models and schemas

## Source of Truth

When repository documents disagree, trust sources in this order:

1. Current code under `apps/` and `packages/`
2. CI workflow commands in `/home/runner/work/gemini-web-wrapper/gemini-web-wrapper/.github/workflows/ci.yml`
3. Runtime setup in `/home/runner/work/gemini-web-wrapper/gemini-web-wrapper/README.md`
4. Planning docs such as `/home/runner/work/gemini-web-wrapper/gemini-web-wrapper/docs/architecture.md`

`docs/architecture.md` describes a broader target architecture and can be ahead of the current implementation.

## Working Rules

- Keep changes small, local, and reversible.
- Preserve the current stateless request model for the API.
- Prefer fixing the real source of truth instead of layering compatibility hacks.
- Do not introduce new package managers: use `uv` for Python and `bun` for JavaScript.
- Do not read environment variables directly in business logic when a typed settings path already exists.
- Update nearby docs only when they are directly affected by the change.

## Backend Guidance

- Keep I/O async-first in FastAPI code.
- Put shared configuration in `packages/config/src/affine/config/settings.py`.
- Provider selection flows through `packages/llm-core/src/affine/llm_core/factory.py`.
- Shared request/response models live in `packages/shared/python/src/affine/shared/`.
- Prefer explicit exceptions and early returns over deep nesting.
- Add or update tests when backend behavior changes.

## Frontend Guidance

- Use typed functional React components.
- Keep components focused on rendering and interaction.
- Put API calls, adapters, and non-trivial business logic in `apps/web/src/services/`.
- Use Zustand for shared app state instead of prop drilling.
- Keep TypeScript strict; avoid `any` unless there is no practical alternative.
- Verify UI changes with `bun run build` before finishing.

## Validation Commands

Use the existing app-scoped commands from CI.

### Frontend

```bash
cd /home/runner/work/gemini-web-wrapper/gemini-web-wrapper/apps/web
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run build
bun run test
```

### API

```bash
cd /home/runner/work/gemini-web-wrapper/gemini-web-wrapper/apps/api
uv sync --all-extras
PYTHONPATH=src:../../packages/config/src uv run ruff format --check
PYTHONPATH=src:../../packages/config/src uv run ruff check
PYTHONPATH=src:../../packages/config/src uv run pyrefly check
PYTHONPATH=src:../../packages/config/src uv run pytest
```

### Shared packages

```bash
cd /home/runner/work/gemini-web-wrapper/gemini-web-wrapper/packages/config
uv sync
uv run ruff format --check
uv run ruff check

cd /home/runner/work/gemini-web-wrapper/gemini-web-wrapper/packages/shared
uv sync
uv run ruff format --check
uv run ruff check
```

## Common Local Commands

### Run the API

```bash
cd /home/runner/work/gemini-web-wrapper/gemini-web-wrapper/apps/api
PYTHONPATH=src:../../packages/config/src uv run uvicorn affine.api.server:app --reload
```

### Run the web app

```bash
cd /home/runner/work/gemini-web-wrapper/gemini-web-wrapper/apps/web
bun run dev
```

## File-Specific Notes

- `CLAUDE.md` should stay a symlink to `AGENTS.md`.
- Keep `/home/runner/work/gemini-web-wrapper/gemini-web-wrapper/.github/copilot-instructions.md` short and aligned with this file.
- Keep detailed language rules in `/home/runner/work/gemini-web-wrapper/gemini-web-wrapper/.github/instructions/`.
- Do not copy aspirational architecture text into implementation guidance unless the code already matches it.

## When Updating Architecture

If you add a provider, endpoint, or package boundary change, update all relevant sources together:

- runtime code
- tests
- `README.md` when user-facing setup changes
- `.github/workflows/ci.yml` when validation changes
- this file and Copilot instructions when agent guidance changes
