# Copilot Instructions

This repository follows the guidance in [`AGENTS.md`](../AGENTS.md).

## Quick Reference

- **Frontend**: React 19 + TypeScript + Vite in `apps/web/`
- **Backend**: FastAPI in `apps/api/src/affine/api/`
- **Shared packages**: `packages/config`, `packages/llm-core`, `packages/shared/python`
- **State**: Zustand in `apps/web/src/store.ts`
- **Settings**: `packages/config/src/affine/config/settings.py`

## Validation

```bash
# Frontend
cd apps/web && bun run lint && bun run typecheck && bun run build

# Backend
cd apps/api && PYTHONPATH=src:../../packages/config/src uv run ruff check && uv run pytest
```

See `AGENTS.md` for complete guidance.
