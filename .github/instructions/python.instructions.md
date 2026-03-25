---
applyTo: "**/{*.py,pyproject.toml}"
---

# Python Standards

## Toolchain

- **Lint/Fmt**: `ruff check --fix && ruff format` (PEP 8, 4-space, 80 chars)
- **Types**: `mypy --strict` (no `Any`; full annotations)
- **Test**: `pytest -v --cov` (95%+ coverage, edge cases)
- **Deps**: `uv sync && uv audit` (security checks)

## Core Rules

- **Style**: PEP 8, PEP 257 (docstrings), PEP 484 (type hints)
- **Types**: Modern generics (`list[str]`); `Protocol` for interfaces; no `Any`
- **Security**: Input validation, no hardcoded secrets, OWASP awareness
- **Perf**: O(n) algorithms; `lru_cache` for expensive ops; generators for large data
- **Arch**: SOLID principles, dependency injection, clean architecture

## Patterns

**Type Safety:**

```python
from typing import Protocol, TypeVar

Entity = TypeVar("Entity")

class Repository(Protocol):
  def get(self, id: str) -> Entity | None: ...
  def save(self, entity: Entity) -> None: ...
```

**Performance:**

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive(n: int) -> int:
  return sum(range(n))

def stream_file(path: str) -> Iterator[str]:
  with open(path) as f:
    for line in f:
      yield line.strip()
```

## 🔐 Security Rules

- Never use `eval()` or `exec()` with user input
- Use parameterized queries for SQL
- Validate all external inputs
- Use `secrets` module for tokens, not `random`

## Forbidden

- Bare `except:` → catch specific exceptions
- `Any` type → use concrete types or `Protocol`
- Hardcoded secrets → use env vars
- O(n²) loops → use sets/dicts for lookups
- Global mutable state → use DI/parameters

## 📦 Import Order

1. Standard library (`os`, `sys`, `typing`)
2. Third-party (`fastapi`, `pydantic`)
3. Local application imports

## ⚡ Best Practices

- Use context managers (`with` statements)
- Prefer list comprehensions over loops
- Use `pathlib` for file paths
- Use `dataclasses` or Pydantic for data structures
