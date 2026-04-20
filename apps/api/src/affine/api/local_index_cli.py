"""CLI for local codebase indexing."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from affine.code_index import (
    CodeIndexer,
    CodeSearchEngine,
    CodeIndexStore,
)
from affine.api.utils import create_local_embedder
from affine.config.settings import get_settings


async def index_command(args: argparse.Namespace) -> int:
    """Run indexing on local codebase."""
    settings = get_settings()

    # Select embedder based on settings
    try:
        embedder = create_local_embedder(settings)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    root = Path(args.root or ".").resolve()
    db_path = Path(args.db or ".index/lancedb").resolve()

    print(f"Indexing {root} -> {db_path}")

    indexer = CodeIndexer(
        root=root,
        embedder=embedder,
        db_path=db_path,
    )

    await indexer.initialize()
    result = await indexer.index(force=args.force)

    print("\nIndexing complete:")
    print(f"  Status: {result['status']}")
    print(f"  Files processed: {result.get('files', 0)}")
    print(f"  AST nodes: {result.get('ast_nodes', 0)}")
    print(f"  Chunks: {result.get('chunks', 0)}")
    if result.get("errors", 0) > 0:
        print(f"  Errors: {result['errors']}")

    await embedder.aclose()
    return 0


async def search_command(args: argparse.Namespace) -> int:
    """Search the index."""
    settings = get_settings()

    # Same embedder selection as index
    try:
        embedder = create_local_embedder(settings)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    db_path = Path(args.db or ".index/lancedb").resolve()

    store = CodeIndexStore(db_path, embedder.dimension)
    await store.initialize()

    engine = CodeSearchEngine(store, embedder)
    results = await engine.search(
        query=args.query,
        k=args.k,
        path_prefix=args.path,
        prefer_ast=not args.no_ast,
    )

    if not results:
        print("No results found.")
        await embedder.aclose()
        return 0

    print(f"\nFound {len(results)} results:\n")
    for i, result in enumerate(results, 1):
        node_type = "AST" if result.is_ast_node else "CHUNK"
        print(f"{i}. [{node_type}] {result.path}:{result.start_line}-{result.end_line}")
        print(f"   kind={result.kind} name={result.name} score={result.score:.3f}")
        code_preview = result.code[:200].replace("\n", " ")
        print(f"   {code_preview}...\n")

    await embedder.aclose()
    return 0


async def stats_command(args: argparse.Namespace) -> int:
    """Show index statistics."""
    settings = get_settings()

    # Need an embedder just to get dimension
    try:
        embedder = create_local_embedder(settings)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    db_path = Path(args.db or ".index/lancedb").resolve()

    store = CodeIndexStore(db_path, embedder.dimension)
    await store.initialize()

    stats = await store.get_stats()
    hashes = await store.get_indexed_file_hashes()

    print(f"Index location: {db_path}")
    print(f"Total records: {stats.get('total_records', 0)}")
    print(f"Indexed files: {len(hashes)}")

    await embedder.aclose()
    return 0


def main() -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Local codebase indexing with LanceDB")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Index command
    index_parser = subparsers.add_parser("index", help="Index codebase")
    index_parser.add_argument(
        "--root",
        help="Root directory to index (default: current directory)",
    )
    index_parser.add_argument(
        "--db",
        help="LanceDB path (default: .index/lancedb)",
    )
    index_parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-index",
    )

    # Search command
    search_parser = subparsers.add_parser("search", help="Search index")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument(
        "--db",
        help="LanceDB path (default: .index/lancedb)",
    )
    search_parser.add_argument(
        "--k",
        type=int,
        default=10,
        help="Number of results (default: 10)",
    )
    search_parser.add_argument(
        "--path",
        help="Path prefix filter",
    )
    search_parser.add_argument(
        "--no-ast",
        action="store_true",
        help="Don't prefer AST nodes over chunks",
    )

    # Stats command
    stats_parser = subparsers.add_parser("stats", help="Show index statistics")
    stats_parser.add_argument(
        "--db",
        help="LanceDB path (default: .index/lancedb)",
    )

    args = parser.parse_args()

    if args.command == "index":
        return asyncio.run(index_command(args))
    elif args.command == "search":
        return asyncio.run(search_command(args))
    elif args.command == "stats":
        return asyncio.run(stats_command(args))

    return 0


if __name__ == "__main__":
    sys.exit(main())
