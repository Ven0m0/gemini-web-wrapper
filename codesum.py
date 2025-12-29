#!/usr/bin/env python3
"""Standalone code summarizer - zero external dependencies."""

import os
import re
import sys
from pathlib import Path

# Constants
SUMMARY_DIR = ".summary_files"
IGNORE_LIST = {
    ".git",
    "venv",
    "__pycache__",
    ".vscode",
    ".idea",
    "node_modules",
    "build",
    "dist",
    ".DS_Store",
    ".env",
    SUMMARY_DIR,
}
BINARY_EXTS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".mp4",
    ".mp3",
    ".zip",
    ".tar",
    ".gz",
    ".exe",
    ".dll",
    ".pdf",
    ".pyc",
    ".pyo",
}


def estimate_tokens(text: str) -> int:
    """Rough token estimate:  4 chars ≈ 1 token."""
    return len(text) // 4


def is_binary(path: Path) -> bool:
    """Check if file is binary."""
    if path.suffix.lower() in BINARY_EXTS:
        return True
    try:
        with path.open("rb") as f:
            chunk = f.read(8192)
        return (
            b"\x00" in chunk
            or sum(1 for b in chunk if b < 32 and b not in (9, 10, 13))
            > len(chunk) * 0.1
        )
    except Exception:
        return True


def parse_gitignore(root: Path) -> set:
    """Parse .gitignore patterns."""
    gi = root / ". gitignore"
    pats = set()
    if gi.exists():
        for line in gi.read_text(errors="ignore").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                pats.add(line.rstrip("/"))
    return pats


def should_ignore(path: Path, root: Path, ignore_pats: set) -> bool:
    """Check if path should be ignored."""
    rel = str(path.relative_to(root))
    for part in Path(rel).parts:
        if part in IGNORE_LIST:
            return True
    for pat in ignore_pats:
        if pat in rel or re.search(pat.replace("*", ".*"), rel):
            return True
    return False


def collect_files(root: Path) -> list[Path]:
    """Collect all text files."""
    ignore_pats = parse_gitignore(root)
    files = []
    for p in root.rglob("*"):
        if p.is_file() and not should_ignore(p, root, ignore_pats) and not is_binary(p):
            files.append(p)
    return sorted(files)


def compress_code(code: str, lang: str) -> str:
    """Semantic compression: extract function/class signatures."""
    lines = code.split("\n")
    sigs = []
    for i, line in enumerate(lines, 1):
        if re.search(
            r"\b(def|function|class|interface|type|const|let|var)\s+\w+", line
        ):
            sigs.append(f"L{i}: {line.strip()}")
            if len(sigs) >= 50:
                break
    return (
        f"# {len(lines)} lines, {len(sigs)} definitions\n"
        + "\n".join(sigs)
        + "\n# [content truncated for brevity]"
    )


def summarize_files(files: list[Path], root: Path, compress: bool = False) -> str:
    """Generate markdown summary."""
    parts = ["# Code Summary\n\n"]
    total_tokens = 0
    for p in files:
        rel = p.relative_to(root)
        lang = p.suffix.lstrip(". ") or "txt"
        try:
            content = p.read_text(encoding="utf-8", errors="ignore")
            if compress and len(content) > 5000:
                content = compress_code(content, lang)
            tokens = estimate_tokens(content)
            total_tokens += tokens
            parts.append(f"## File: {rel}\n```{lang}\n{content}\n```\n\n")
        except Exception as e:
            parts.append(f"## File: {rel}\n*Error reading file: {e}*\n\n")
    parts.append(f"---\n**Estimated tokens**: ~{total_tokens}\n")
    return "".join(parts)


def select_files_interactive(files: list[Path], root: Path) -> list[Path]:
    """Interactive file selection."""
    selected = []
    print(
        f"Found {len(files)} files. Select files (y/n/a=all/q=quit):", file=sys.stderr
    )
    for f in files:
        rel = f.relative_to(root)
        resp = input(f"{rel}? ").strip().lower()
        if resp in ("a", "all"):
            return files
        if resp in ("q", "quit"):
            break
        if resp in ("y", "yes"):
            selected.append(f)
    return selected


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate optimized code summaries for LLMs"
    )
    parser.add_argument(
        "-c",
        "--compress",
        action="store_true",
        help="Compress large files (extract signatures)",
    )
    parser.add_argument(
        "-a", "--all", action="store_true", help="Auto-select all files"
    )
    parser.add_argument(
        "-o",
        "--output",
        default=None,
        help="Output file (default:  .summary_files/code_summary.md)",
    )
    args = parser.parse_args()

    root = Path.cwd()
    summary_dir = root / SUMMARY_DIR
    summary_dir.mkdir(exist_ok=True)
    output = Path(args.output) if args.output else summary_dir / "code_summary.md"

    print(f"Scanning {root} for code files...", file=sys.stderr)
    files = collect_files(root)

    if not args.all:
        files = select_files_interactive(files, root)
    if not files:
        print("No files selected.", file=sys.stderr)
        return 0

    print(f"Generating summary for {len(files)} files...", file=sys.stderr)
    summary = summarize_files(files, root, compress=args.compress)

    output.write_text(summary, encoding="utf-8")
    tokens = estimate_tokens(summary)
    print(f"✓ Summary written to {output}", file=sys.stderr)
    print(f"  Estimated tokens: ~{tokens}", file=sys.stderr)

    # Try clipboard copy (optional, no external libs)
    try:
        if sys.platform == "darwin":
            os.system(f"pbcopy < {output}")
        elif os.environ.get("DISPLAY"):
            os.system(
                f"xclip -sel clip < {output} 2>/dev/null || xsel --clipboard < {output} 2>/dev/null"
            )
        print("  Copied to clipboard", file=sys.stderr)
    except Exception:
        pass

    return 0


if __name__ == "__main__":
    sys.exit(main())
