# AGENTS.md — Gemini Web Wrapper

Canonical repository guidance for Copilot, OpenCode, and other agents. Keep this file as the long-form source of truth, keep `.github/copilot-instructions.md` short and aligned with it, and keep `CLAUDE.md` as a symlink to this file.

## Instruction precedence

1. `AGENTS.md` for repo-wide rules and workflows.
2. `.github/instructions/*.instructions.md` for path-specific guidance.
3. `.github/skills/*/SKILL.md` for reusable task workflows invoked on demand.

## Repository map

- `apps/web` — React 19 + TypeScript + Vite 8 PWA
  - Shared state lives in `apps/web/src/store.ts`.
  - API clients and non-trivial browser logic belong in `apps/web/src/services/`.
  - Tooling comes from `apps/web/package.json` and the root Bun workspace.
- `apps/api` — FastAPI backend
  - App entrypoint: `apps/api/src/affine/api/server.py`
  - Module entrypoint: `apps/api/src/affine/api/__main__.py`
  - Main routes include `/health`, `/v1/models`, `/v1/chat/completions`, `/v1/agent/chat`, and the repo/local indexing routers.
- `packages/config` — typed settings and cached `get_settings()`
- `packages/llm-core` — provider interfaces, factory, and built-in providers
- `packages/shared/python` — shared schemas and OpenAI-style request/response models
- `packages/code-index` — repository discovery, parsing, chunking, embedding, and search helpers under `packages/code-index/src/affine/code_index/`

## Source of truth

When guidance disagrees, prefer:

1. Current code in `apps/` and `packages/`
2. `.github/workflows/ci.yml`
3. `README.md`
4. Other docs under `docs/`

Use the code and CI as the baseline, and update guidance when runtime behavior or validation changes.

## Working rules

- Keep changes focused, local, and easy to review.
- Use the repository toolchains only: `bun` for JS/TS and `uv` for Python.
- Follow the existing layout instead of introducing parallel patterns.
- Keep repo-wide guidance here and keep path-specific details in `.github/instructions/`.
- Update related guidance files together when commands, entrypoints, or workflows change.

## Frontend guidance

- Use typed functional React components.
- Keep rendering concerns in components and move API adapters or substantial browser logic into `apps/web/src/services/`.
- Reuse Zustand state in `apps/web/src/store.ts` for shared app state.
- Preserve strict TypeScript expectations; prefer `interface` for object-shaped contracts and avoid `any` when a precise type is available.
- Keep provider secrets and provider SDK calls out of the frontend.

## Backend guidance

- Keep FastAPI handlers async-first and explicit.
- Route settings access through `packages/config/src/affine/config/settings.py`.
- Route provider selection through `packages/llm-core/src/affine/llm_core/factory.py`.
- Reuse schemas from `packages/shared/python/src/affine/shared/`.
- Add or update tests when backend behavior changes.

## Validation commands

### Frontend (`apps/web`)

```bash
cd apps/web
bun install
bun run lint
bun run typecheck
bun run build
```

- `bun run test` runs `vitest run`; run it when you change frontend application code, test files, or release validation.

### API (`apps/api`)

```bash
cd apps/api
export PYTHONPATH=src:../../packages/config/src
uv sync --all-extras
uv run ruff format --check
uv run ruff check
uv run pyrefly check
uv run pytest
```

### Shared packages

```bash
cd packages/config && uv sync && uv run ruff format --check src/ && uv run ruff check src/
cd packages/llm-core && uv sync && uv run ruff format --check src/ && uv run ruff check src/
cd packages/shared/python && uv sync && uv run ruff format --check src/ && uv run ruff check src/
cd packages/code-index && uv sync && uv run ruff format --check src/ && uv run ruff check src/
```

## Common local commands

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

## Automation notes

- `CLAUDE.md` should remain a symlink to `AGENTS.md`.
- `.opencode/opencode.json` also points at `AGENTS.md`, so repo-wide changes here affect OpenCode sessions too.
- `.github/workflows/release.yml` publishes on `v*` tags after frontend validation.
- `.github/workflows/run-agent.yml` supports optional secrets: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `JULES_API_KEY`, `OPENCODE_API_KEY`, `OPENROUTER_API_KEY`, `KILO_API_KEY`, and `KILO_ORG_ID`.
