# Gemini Web Wrapper — Copilot Instructions

Use this file for repo-specific behavior only. For detailed style rules, also follow the files in `/home/runner/work/gemini-web-wrapper/gemini-web-wrapper/.github/instructions/`.

## Repository Reality

- The current backend is Python FastAPI code in `apps/api/src/affine/api/server.py`.
- The current frontend is a React 19 + TypeScript + Vite app in `apps/web`.
- Shared Python code lives in `packages/config`, `packages/llm-core`, and `packages/shared/python`.
- `docs/architecture.md` is broader than the current implementation, so prefer code, CI, and README when they conflict.

## What Copilot Should Optimize For

1. Small, accurate edits that match the existing implementation.
2. Stateless backend behavior and typed settings-based configuration.
3. Async-first Python I/O and strict TypeScript.
4. Business logic in frontend service files, not inline in React components.
5. Reuse of shared models, settings, and provider abstractions before adding new code paths.

## Backend Rules

- Use `packages/config/src/affine/config/settings.py` for configuration.
- Do not introduce direct environment access in business logic if settings already cover the value.
- Keep FastAPI handlers and provider integrations typed and explicit.
- Reuse `packages/shared/python/src/affine/shared/` schemas for API contracts.
- Add or update pytest coverage when backend behavior changes.

## Frontend Rules

- Use typed functional components.
- Keep rendering concerns in components and business logic in `apps/web/src/services/`.
- Use Zustand in `apps/web/src/store.ts` for shared state.
- Avoid `any` unless there is no practical typed option.
- Validate UI changes with a production build.

## Validation Commands

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

## Agent File Hygiene

- Keep `CLAUDE.md` as a symlink to `AGENTS.md`.
- Keep this file concise and repo-specific.
- Put durable, cross-tool guidance in `AGENTS.md`.
- Put language-specific rules in `.github/instructions/*.instructions.md` instead of duplicating them here.
