"""CLI for local codebase indexing."""

import argparse
import asyncio
import sys
from pathlib import Path

from affine.code_index import (
    CodeIndexer,
    CodeSearchEngine,
    CodeIndexStore,
)
from affine.config.settings import get_settings
from .utils import create_local_embedder


async def index_command(args: argparse.Namespace) -> int:
    """Run indexing on local codebase."""
    settings = get_settings()

    # Select embedder based on settings
    embedder = create_local_embedder(settings)
    if embedder is None:
        print("Error: No API key configured for embedding", file=sys.stderr)
        return 1

    root = Path(args.root or ".")
    db_path = Path(args.db or ".index/lancedb")

    print(f"Indexing {root} into {db_path}...")
    indexer = CodeIndexer(
        root=root,
        embedder=embedder,
        db_path=db_path,
    )

    await indexer.initialize()

    try:
        result = await indexer.index(force=args.force)
        print("\nIndexing complete!")
        print(f"Files: {result.get('files', 0)}")
        print(f"AST Nodes: {result.get('ast_nodes', 0)}")
        print(f"Chunks: {result.get('chunks', 0)}")
        if result.get("errors"):
            print(f"Errors: {result['errors']}")
        return 0
    except Exception as e:
        print(f"Error during indexing: {e}", file=sys.stderr)
        return 1
    finally:
        await embedder.aclose()


async def search_command(args: argparse.Namespace) -> int:
    """Search the index."""
    settings = get_settings()

    # Same embedder selection as index
    embedder = create_local_embedder(settings)
    if embedder is None:
        print("Error: No API key configured for embedding", file=sys.stderr)
        return 1

    db_path = Path(args.db or ".index/lancedb")

    if not db_path.exists():
        print(f"Error: Index not found at {db_path}", file=sys.stderr)
        print("Run 'index' command first.", file=sys.stderr)
        return 1

    store = CodeIndexStore(db_path, embedder.dimension)
    await store.initialize()

    engine = CodeSearchEngine(store, embedder)

    try:
        results = await engine.search(
            query=args.query,
            k=args.k,
            path_prefix=args.path,
        )

        if not results:
            print("No results found.")
            return 0

        for i, result in enumerate(results, 1):
            print(f"\n{i}. {result.path}:{result.start_line}-{result.end_line}")
            print(f"   [{result.kind}] {result.name} (score: {result.score:.3f})")

            # Print a snippet of the code
            lines = result.code.splitlines()
            snippet = "\n   ".join(lines[:5])
            if len(lines) > 5:
                snippet += "\n   ..."
            print(f"   {snippet}")

        return 0
    except Exception as e:
        print(f"Error during search: {e}", file=sys.stderr)
        return 1
    finally:
        await embedder.aclose()


def main() -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Local codebase indexing and search")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    subparsers.required = True

    # Index command
    index_parser = subparsers.add_parser("index", help="Index local codebase")
    index_parser.add_argument(
        "--root", help="Root directory to index (default: current directory)"
    )
    index_parser.add_argument(
        "--db", help="Path to store LanceDB index (default: .index/lancedb)"
    )
    index_parser.add_argument(
        "--force", action="store_true", help="Force re-indexing of all files"
    )

    # Search command
    search_parser = subparsers.add_parser("search", help="Search the indexed codebase")
    search_parser.add_argument("query", help="Natural language search query")
    search_parser.add_argument(
        "--db", help="Path to LanceDB index (default: .index/lancedb)"
    )
    search_parser.add_argument(
        "-k", type=int, default=10, help="Number of results to return (default: 10)"
    )
    search_parser.add_argument("--path", help="Optional path prefix to filter results")

    args = parser.parse_args()

    try:
        if args.command == "index":
            return asyncio.run(index_command(args))
        elif args.command == "search":
            return asyncio.run(search_command(args))
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
        return 130
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
