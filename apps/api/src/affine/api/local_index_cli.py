"""CLI for local codebase indexing."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

from fastapi import HTTPException

from affine.api.local_index import create_local_embedder, open_engine
from affine.code_index import CodeIndexer
from affine.config.settings import Settings, get_settings

logger = logging.getLogger(__name__)


def _settings(args: argparse.Namespace) -> Settings:
    settings = get_settings()
    if args.db:
        return settings.model_copy(
            update={"local_index_db_path": Path(args.db).resolve()}
        )
    return settings


async def index_command(args: argparse.Namespace) -> int:
    """Run indexing on local codebase."""
    settings = _settings(args)

    try:
        embedder = create_local_embedder(settings)
    except Exception as exc:  # noqa: BLE001 - any init failure is a clean CLI error
        logger.error("Error: Failed to initialize embedder: %s", exc)
        return 1

    root = Path(args.root or ".").resolve()
    db_path = settings.local_index_db_path.resolve()

    logger.info(f"Indexing {root} -> {db_path}")

    try:
        indexer = CodeIndexer(root=root, embedder=embedder, db_path=db_path)
        await indexer.initialize()
        result = await indexer.index(force=args.force)
    finally:
        await embedder.aclose()

    logger.info("\nIndexing complete:")
    logger.info(f"  Status: {result['status']}")
    logger.info(f"  Files processed: {result.get('files', 0)}")
    logger.info(f"  AST nodes: {result.get('ast_nodes', 0)}")
    logger.info(f"  Chunks: {result.get('chunks', 0)}")
    if result.get("errors", 0) > 0:
        logger.info(f"  Errors: {result['errors']}")
    return 0


async def search_command(args: argparse.Namespace) -> int:
    """Search the index."""
    try:
        async with open_engine(_settings(args)) as (_, engine):
            results = await engine.search(
                query=args.query,
                k=args.k,
                path_prefix=args.path,
                prefer_ast=not args.no_ast,
            )
    except HTTPException as exc:
        logger.error("Error: %s", exc.detail)
        return 1

    if not results:
        logger.info("No results found.")
        return 0

    logger.info(f"\nFound {len(results)} results:\n")
    for i, result in enumerate(results, 1):
        node_type = "AST" if result.is_ast_node else "CHUNK"
        logger.info(
            f"{i}. [{node_type}] {result.path}:{result.start_line}-{result.end_line}"
        )
        logger.info(
            f"   kind={result.kind} name={result.name} score={result.score:.3f}"
        )
        code_preview = result.code[:200].replace("\n", " ")
        logger.info(f"   {code_preview}...\n")
    return 0


async def stats_command(args: argparse.Namespace) -> int:
    """Show index statistics."""
    settings = _settings(args)
    try:
        async with open_engine(settings) as (store, _):
            stats = await store.get_stats()
            hashes = await store.get_indexed_file_hashes()
    except HTTPException as exc:
        logger.error("Error: %s", exc.detail)
        return 1

    logger.info(f"Index location: {settings.local_index_db_path.resolve()}")
    logger.info(f"Total records: {stats.get('total_records', 0)}")
    logger.info(f"Indexed files: {len(hashes)}")
    return 0


def main() -> int:
    """CLI entry point."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
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
        help="LanceDB path (default: LOCAL_INDEX_DB_PATH, .cache/lancedb)",
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
        help="LanceDB path (default: LOCAL_INDEX_DB_PATH, .cache/lancedb)",
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
        help="LanceDB path (default: LOCAL_INDEX_DB_PATH, .cache/lancedb)",
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
