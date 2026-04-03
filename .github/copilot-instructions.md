# Copilot Instructions

Follow `AGENTS.md` for full repository guidance.

## Current Repo Reality

- Monorepo with `bun` for JS and TS and `uv` for Python
- Frontend: `apps/web` — React 19, TypeScript, Vite PWA, Zustand, `src/services/` for API and business logic
- Backend: `apps/api` — FastAPI in `src/affine/api/server.py`
- Shared Python packages: `packages/config`, `packages/llm-core`, `packages/shared/python`

## Source of Truth

1. Code in `apps/` and `packages/`
2. `.github/workflows/ci.yml`
3. `README.md`

## Validate with Current CI Commands

```bash
cd apps/web && bun install && bun run lint && bun run typecheck && bun run build
cd apps/api && export PYTHONPATH=src:../../packages/config/src && uv sync --all-extras && uv run ruff format --check && uv run ruff check && uv run pyrefly check && uv run pytest
```

## Guardrails

- Keep edits focused and avoid unrelated cleanup.
- Do not introduce a new package manager.
- Do not copy aspirational docs into implementation guidance.
- Keep this file aligned with `AGENTS.md`.

