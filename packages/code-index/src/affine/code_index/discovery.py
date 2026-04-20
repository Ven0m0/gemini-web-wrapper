"""File discovery and change detection."""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator


@dataclass
class FileInfo:
    """Information about a discovered file."""

    path: str
    absolute_path: Path
    size: int
    mtime: float
    content_hash: str
    content: str


class FileDiscovery:
    """Discover and track source files."""

    DEFAULT_IGNORE = {
        ".git",
        "node_modules",
        "__pycache__",
        ".venv",
        "venv",
        ".cache",
        "dist",
        "build",
        ".index",
        "target",
        ".eggs",
        "*.egg-info",
        ".tox",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
    }

    DEFAULT_EXTENSIONS = {
        ".py",
        ".rs",
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mjs",
        ".go",
        ".java",
        ".cpp",
        ".c",
        ".h",
        ".hpp",
        ".rb",
        ".php",
        ".swift",
        ".kt",
        ".scala",
        ".sh",
        ".bash",
    }

    def __init__(
        self,
        root: Path,
        extensions: set[str] | None = None,
        ignore_dirs: set[str] | None = None,
        max_file_bytes: int = 262_144,
    ):
        self.root = root.resolve()
        self.extensions = extensions or self.DEFAULT_EXTENSIONS
        self.ignore_dirs = ignore_dirs or self.DEFAULT_IGNORE
        self.max_file_bytes = max_file_bytes

    def _should_ignore_dir(self, dirname: str) -> bool:
        """Check if directory should be ignored."""
        if dirname.startswith("."):
            return True
        if dirname in self.ignore_dirs:
            return True
        return False

    def discover(self) -> Iterator[FileInfo]:
        """Yield all matching files with content hashes."""
        for dirpath, dirnames, filenames in os.walk(self.root):
            # Filter ignored directories in-place
            dirnames[:] = [d for d in dirnames if not self._should_ignore_dir(d)]

            for filename in filenames:
                filepath = Path(dirpath) / filename

                # Check extension
                if filepath.suffix.lower() not in self.extensions:
                    continue

                # Check size
                try:
                    stat = filepath.stat()
                    if stat.st_size > self.max_file_bytes:
                        continue
                except OSError:
                    continue

                # Read and hash
                try:
                    content = filepath.read_text(encoding="utf-8", errors="ignore")
                    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()[
                        :16
                    ]
                except OSError, UnicodeDecodeError:
                    continue

                yield FileInfo(
                    path=str(filepath.relative_to(self.root)),
                    absolute_path=filepath,
                    size=stat.st_size,
                    mtime=stat.st_mtime,
                    content_hash=content_hash,
                    content=content,
                )

    def compute_batch_hash(self, files: list[FileInfo]) -> str:
        """Compute aggregate hash for batch change detection."""
        hashes = sorted(f.content_hash for f in files)
        return hashlib.sha256("".join(hashes).encode()).hexdigest()[:16]

    def get_changed_files(
        self, files: list[FileInfo], indexed_hashes: set[str]
    ) -> list[FileInfo]:
        """Return only files that have changed (not in indexed_hashes)."""
        return [f for f in files if f.content_hash not in indexed_hashes]
