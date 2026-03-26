"""Compatibility helpers for legacy root-level modules.

These wrappers keep historical imports working while the packaged API in
`apps/api/src/affine/api` is the canonical implementation.
"""

from __future__ import annotations

import sys
from pathlib import Path

def bootstrap() -> None:
    """Ensure packaged API and shared config sources are importable."""

    repo_root = Path(__file__).resolve().parent
    candidates = [repo_root / "apps/api/src", repo_root / "packages/config/src"]
    candidates.extend((repo_root / "apps/api/.venv/lib").glob("python*/site-packages"))
    for candidate in candidates:
        candidate_str = str(candidate)
        if candidate.exists() and candidate_str not in sys.path:
            sys.path.insert(0, candidate_str)
