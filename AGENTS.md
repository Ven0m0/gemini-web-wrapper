# AGENTS.md — Gemini Web Wrapper

Canonical repository guidance for agentic tools. `CLAUDE.md` must remain a symlink to this file. If other assistant-facing mirror files are added later, keep them symlinked or otherwise explicitly synchronized.

## Project Snapshot

Gemini Web Wrapper is a monorepo for a FastAPI backend, a React PWA frontend, and shared Python packages.

- **Frontend:** `apps/web`
  - React 19 + TypeScript + Vite PWA
  - Zustand state in `src/store.ts`
  - Business logic and API clients belong in `src/services/`
- **Backend:** `apps/api`
  - Python FastAPI app in `src/affine/api/server.py`
  - Package entrypoint in `src/affine/api/__main__.py` for `python -m affine.api`
  - Current mounted endpoints are implemented directly in `server.py`
- **Shared Python packages:**
  - `packages/config` — typed settings
  - `packages/llm-core` — provider interfaces and factory
  - `packages/shared/python` — shared models and schemas

## Source of Truth

When repository documents disagree, trust sources in this order:

1. Current code under `apps/` and `packages/`
2. CI workflow commands in `.github/workflows/ci.yml`
3. Runtime setup in `README.md`
4. Planning docs such as `docs/architecture.md`

`docs/architecture.md` describes a broader target architecture and can be ahead of the current implementation. Keep this file and `.github/copilot-instructions.md` aligned with the higher-priority sources above.

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
cd apps/web
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run build
bun run test
```

### API

Follow the current CI and README pattern here: `affine-llm-core` and `affine-shared` resolve as workspace dependencies, while `config` is still provided through an explicit `PYTHONPATH` entry.

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
uv run ruff format --check
uv run ruff check

cd packages/shared
uv sync
uv run ruff format --check
uv run ruff check
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

## File-Specific Notes

- `CLAUDE.md` should stay a symlink to `AGENTS.md`.
- Keep `.github/copilot-instructions.md` short and aligned with this file.
- Do not copy aspirational architecture text into implementation guidance unless the code already matches it.

## When Updating Architecture

If you add a provider, endpoint, or package boundary change, update all relevant sources together:

- runtime code
- tests
- `README.md` when user-facing setup changes
- `.github/workflows/ci.yml` when validation changes
- this file and Copilot instructions when agent guidance changes

## Architecture Constraints

- One frontend (`apps/web`)
- One backend API (`apps/api`)
- One provider abstraction (`packages/llm-core`)
- Provider SDKs and provider-specific request shaping live ONLY in the provider abstraction layer
- The frontend must NEVER call provider SDKs directly
- The frontend must NEVER embed provider keys into bundles
- Streaming must use one canonical event format (`ChatStreamChunk`) across all providers

## Security Requirements

- All mutation paths must be permission-checked and audit logged
- Secrets must not appear in API responses, frontend state persisted to disk, or logs
- Enforce payload caps and timeouts on LLM requests, streaming sessions, tool execution, and file operations
- Every API request gets a request ID
- Every provider call logs provider, model, mode, latency, and request ID
- Tool calls must log name, inputs (redacted as needed), outputs (redacted as needed), duration, and permission decision

## Forbidden Shortcuts

- Do not copy entire legacy app directories into this repo
- Do not implement "just for now" provider logic in the frontend
- Do not add a second workspace model for GitHub vs local (same abstraction, different adapter)
- Do not enable remote plugins by default
- Do not run untrusted plugin code via `eval`, `new Function`, or unrestricted dynamic import
