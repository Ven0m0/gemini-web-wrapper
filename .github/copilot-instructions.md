# Copilot Instructions

Use `AGENTS.md` as the canonical repo-wide guide.

## Instruction precedence

1. `AGENTS.md` for repo-wide rules, commands, and automation notes.
2. `.github/instructions/*.instructions.md` for path-specific guidance.
3. `.github/skills/*/SKILL.md` when a reusable workflow applies.

## Quick repo map

- `apps/web`: React 19 + TypeScript + Vite PWA. Keep shared state in `apps/web/src/store.ts` and move API/business logic into `apps/web/src/services/`.
- `apps/api`: FastAPI app in `apps/api/src/affine/api/server.py`.
- Python packages: `packages/config`, `packages/llm-core`, `packages/shared/python`, `packages/code-index`.

## Validation

```bash
cd apps/web && bun install && bun run lint && bun run typecheck && bun run build
cd apps/api && export PYTHONPATH=src:../../packages/config/src && uv sync --all-extras && uv run ruff format --check && uv run ruff check && uv run pyrefly check && uv run pytest
```

Use `bun run test` when you change frontend application code, test files, or release validation.

## Guardrails

- Use `bun` for JS/TS work and `uv` for Python work.
- Keep repo-wide guidance in `AGENTS.md` and update this file only as a short bootstrap mirror.
- Keep `CLAUDE.md` as a symlink to `AGENTS.md`.
