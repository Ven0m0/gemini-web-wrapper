---
applyTo: "{apps/api,packages/config,packages/llm-core,packages/shared/python,packages/code-index}/**/*.py"
---

# Python Guidance

## Toolchain

- Package manager: `uv`
- Formatting and linting: `ruff`
- API type-checking: `pyrefly`
- API tests: `pytest`

## Repository hotspots

- FastAPI app: `apps/api/src/affine/api/server.py`
- Settings: `packages/config/src/affine/config/settings.py`
- Provider factory: `packages/llm-core/src/affine/llm_core/factory.py`
- Shared schemas: `packages/shared/python/src/affine/shared/`
- Code indexing modules: `packages/code-index/src/affine/code_index/`

## Validation

### API changes

```bash
cd apps/api
export PYTHONPATH=src:../../packages/config/src
uv sync --all-extras
uv run ruff format --check
uv run ruff check
uv run pyrefly check
uv run pytest
```

### Package changes

```bash
cd packages/config && uv sync && uv run ruff format --check src/ && uv run ruff check src/
cd packages/llm-core && uv sync && uv run ruff format --check src/ && uv run ruff check src/
cd packages/shared/python && uv sync && uv run ruff format --check src/ && uv run ruff check src/
cd packages/code-index && uv sync && uv run ruff format --check src/ && uv run ruff check src/
```

## Expectations

- Keep FastAPI handlers async-first and use explicit control flow.
- Route settings access through `packages/config`.
- Route provider selection through `packages/llm-core`.
- Reuse shared request and response models from `packages/shared/python`.
- Prefer precise types, modern generics, and small helper functions over broad `Any` usage.
- Validate external inputs and avoid leaking secrets or provider credentials.
