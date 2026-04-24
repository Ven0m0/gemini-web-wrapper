"""Hybrid semantic + structural search."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .embedder import Embedder
from .store import CodeIndexStore


@dataclass
class SearchResult:
    """Search result with metadata."""

    path: str
    kind: str
    name: str
    code: str
    start_line: int
    end_line: int
    score: float
    is_ast_node: bool
    signature: str | None = None
    pattern: str | None = None
    symbol_kind: str | None = None
    doc: str | None = None


class CodeSearchEngine:
    """Hybrid search: AST nodes first, chunks as fallback."""

    def __init__(self, store: CodeIndexStore, embedder: Embedder):
        self.store = store
        self.embedder = embedder

    async def search(
        self,
        query: str,
        k: int = 10,
        path_prefix: str | None = None,
        prefer_ast: bool = True,
    ) -> list[SearchResult]:
        """Search with hybrid ranking."""
        # Embed query
        vectors = await self.embedder.embed([query], input_type="query")
        query_vector = vectors[0]

        # Search with optional filters
        results = await self.store.search(
            query_vector,
            k=k * 2 if prefer_ast else k,
            path_filter=path_prefix,
            exclude_chunks=False,
        )

        # Sort: AST nodes first, then by score
        if prefer_ast:
            ast_nodes = [r for r in results if r["kind"] != "chunk"]
            chunks = [r for r in results if r["kind"] == "chunk"]
            results = ast_nodes + chunks

        # Convert to SearchResult
        search_results = [self._to_result(r) for r in results[:k]]
        return search_results

    async def search_ast_only(
        self,
        query: str,
        k: int = 10,
        path_prefix: str | None = None,
    ) -> list[SearchResult]:
        """Search only AST nodes (no chunks)."""
        vectors = await self.embedder.embed([query], input_type="query")
        query_vector = vectors[0]

        results = await self.store.search(
            query_vector,
            k=k,
            path_filter=path_prefix,
            exclude_chunks=True,
        )

        return [self._to_result(r) for r in results]

    async def search_structural(
        self,
        kind: str | None = None,
        name_pattern: str | None = None,
        code_pattern: str | None = None,
        path_prefix: str | None = None,
        k: int = 10,
    ) -> list[SearchResult]:
        """Structural search by kind, name, and code (no semantic search)."""
        results = await self.store.search_structural(
            kind=kind,
            name_pattern=name_pattern,
            code_pattern=code_pattern,
            path_prefix=path_prefix,
            k=k,
        )
        return [self._to_result(r) for r in results]

    async def get_file_outline(self, path: str) -> list[SearchResult]:
        """Get all symbols in a specific file."""
        results = await self.store.search_structural(
            path_prefix=path,
            k=1000,
        )
        # Filter for exact path and AST nodes
        file_results = [
            r for r in results if r["path"] == path and r["kind"] != "chunk"
        ]
        # Sort by line number
        file_results.sort(key=lambda r: r["start_line"])
        return [self._to_result(r) for r in file_results]

    async def get_repo_outline(self, k: int = 500) -> list[SearchResult]:
        """Get top symbols across the repository."""
        results = await self.store.search_structural(
            kind=None,
            k=k,
        )
        # Filter out chunks
        repo_results = [r for r in results if r["kind"] != "chunk"]
        return [self._to_result(r) for r in repo_results]

    async def get_symbol(self, path: str, kind: str, name: str) -> SearchResult | None:
        """Get a specific symbol by path, kind and name."""
        results = await self.store.search_structural(
            kind=kind,
            path_prefix=path,
            k=100,
        )
        for r in results:
            if r["path"] == path and r["kind"] == kind and r["name"] == name:
                return self._to_result(r)
        return None

    def _to_result(self, record: dict[str, Any]) -> SearchResult:
        """Convert DB record to SearchResult."""
        # Distance is cosine distance (0 = identical, 2 = opposite)
        # Convert to similarity score (1 = identical, 0 = opposite)
        distance = record.get("_distance", 0.0)
        score = 1.0 - (distance / 2.0)  # Normalize to 0-1

        return SearchResult(
            path=record["path"],
            kind=record["kind"],
            name=record["name"],
            code=record["code"],
            start_line=int(record["start_line"]),
            end_line=int(record["end_line"]),
            score=round(score, 3),
            is_ast_node=record["kind"] != "chunk",
            signature=record.get("signature"),
            pattern=record.get("pattern"),
            symbol_kind=record.get("symbol_kind"),
            doc=record.get("doc"),
        )
