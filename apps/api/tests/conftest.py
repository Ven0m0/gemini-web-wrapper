from pathlib import Path
import sys


# Locate the repository root by walking up until we find a pyproject.toml that
# lists [tool.uv.workspace] (i.e., the monorepo root).  This is more robust
# than hard-coding the number of parent hops.
def _find_repo_root(start: Path) -> Path:
    target = b"[tool.uv.workspace]"
    for parent in [start, *start.parents]:
        marker = parent / "pyproject.toml"
        if marker.exists():
            # Read only the first 4 KB — enough to contain the workspace table
            # header without loading potentially large files into memory.
            with marker.open("rb") as fh:
                if target in fh.read(4096):
                    return parent
    # Fallback: four levels up from this conftest (apps/api/tests/conftest.py)
    return start.parents[3]


ROOT = _find_repo_root(Path(__file__).resolve().parent)

sys.path.insert(0, str(ROOT / "apps/api/src"))
sys.path.insert(0, str(ROOT / "packages/shared/python/src"))
sys.path.insert(0, str(ROOT / "packages/llm-core/src"))
sys.path.insert(0, str(ROOT / "packages/config/src"))
