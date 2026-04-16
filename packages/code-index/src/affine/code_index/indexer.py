"""Main indexing orchestrator."""

from __future__ import annotations

import hashlib
from collections.abc import Iterator
from datetime import datetime
from pathlib import Path
from typing import Any

from .chunker import Chunk, SlidingWindowChunker
from .discovery import FileDiscovery, FileInfo
from .embedder import Embedder
from .parser import ASTNode, ASTParser, PatternMatch
from .store import CodeIndexStore


class CodeIndexer:
    """End-to-end code indexing pipeline."""

    def __init__(
        self,
        root: Path,
        embedder: Embedder,
        db_path: Path,
        chunk_size: int = 800,
        chunk_overlap: int = 200,
        batch_size: int = 100,
        embedding_batch_size: int = 100,
    ):
        self.root = root
        self.embedder = embedder
        self.db_path = db_path
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.batch_size = batch_size
        self.embedding_batch_size = embedding_batch_size

        self.parser = ASTParser()
        self.chunker = SlidingWindowChunker(chunk_size, chunk_overlap)
        self.discovery = FileDiscovery(root)
        self.store: CodeIndexStore | None = None

    async def initialize(self) -> None:
        """Initialize storage."""
        self.store = CodeIndexStore(self.db_path, self.embedder.dimension)
        await self.store.initialize()

    async def index(self, force: bool = False) -> dict[str, Any]:
        """Run full indexing pipeline."""
        if self.store is None:
            raise RuntimeError("Indexer not initialized")

        # Discover files
        files = list(self.discovery.discover())

        if not files:
            return {"status": "no_files", "files": 0, "indexed": 0}

        # Check for changes
        if not force:
            current_hashes = {f.content_hash for f in files}
            indexed_hashes = await self.store.get_indexed_file_hashes()

            if current_hashes == indexed_hashes:
                stats = await self.store.get_stats()
                return {
                    "status": "unchanged",
                    "files": len(files),
                    "indexed": 0,
                    "total_records": stats.get("total_records", 0),
                }

        # Clear index if forcing
        if force:
            # Delete all existing entries
            for file_hash in await self.store.get_indexed_file_hashes():
                await self.store.delete_by_file_hash(file_hash)

        # Process in parallel batches
        stats: dict[str, int] = {
            "files": 0,
            "ast_nodes": 0,
            "chunks": 0,
            "errors": 0,
        }

        for batch in self._batch(files, self.batch_size):
            batch_stats = await self._process_batch(batch)
            stats["files"] += batch_stats["files"]
            stats["ast_nodes"] += batch_stats["ast_nodes"]
            stats["chunks"] += batch_stats["chunks"]
            stats["errors"] += batch_stats["errors"]

        return {"status": "indexed", **stats}

    async def _process_batch(self, files: list[FileInfo]) -> dict[str, int]:
        """Process a batch of files."""
        stats = {"files": 0, "ast_nodes": 0, "chunks": 0, "errors": 0}
        records: list[dict[str, Any]] = []

        for file_info in files:
            try:
                file_records = self._extract_records(file_info)
                records.extend(file_records)
                stats["files"] += 1
                stats["ast_nodes"] += len(
                    [r for r in file_records if r["kind"] != "chunk"]
                )
                stats["chunks"] += len(
                    [r for r in file_records if r["kind"] == "chunk"]
                )
            except Exception:
                stats["errors"] += 1
                continue

        # Batch embed and store
        if records:
            await self._embed_and_store(records)

        return stats

    def _extract_records(self, file_info: FileInfo) -> list[dict[str, Any]]:
        """Extract all indexable records from a file."""
        records: list[dict[str, Any]] = []
        seen_bytes: set[tuple[int, int]] = set()

        # 1. AST nodes (primary)
        ast_nodes = list(self.parser.parse_file(file_info.path, file_info.content))

        for node in ast_nodes:
            key = (node.start_byte, node.end_byte)
            if key in seen_bytes:
                continue
            seen_bytes.add(key)

            record_id = self._compute_id(file_info, node)

            # Determine pattern field
            pattern = None
            if isinstance(node, PatternMatch):
                pattern = node.pattern

            # Determine doc and symbol_kind
            doc = node.doc if isinstance(node, ASTNode) else None
            symbol_kind = node.symbol_kind if isinstance(node, ASTNode) else None

            records.append(
                {
                    "id": record_id,
                    "path": node.path,
                    "kind": node.kind,
                    "name": node.name,
                    "code": node.code if isinstance(node, ASTNode) else node.code,
                    "start_byte": node.start_byte,
                    "end_byte": node.end_byte,
                    "start_line": node.start_line,
                    "end_line": node.end_line,
                    "pattern": pattern,
                    "symbol_kind": symbol_kind,
                    "doc": doc,
                    "file_hash": file_info.content_hash,
                    "indexed_at": datetime.now(),
                }
            )

        # 2. Chunks (fallback for files with few AST nodes)
        if len(records) < 3:
            chunks = self.chunker.chunk_file(file_info.path, file_info.content)
            for chunk in chunks:
                # Skip chunks that overlap with AST nodes
                if any(
                    not (chunk.end_byte <= start or chunk.start_byte >= end)
                    for start, end in seen_bytes
                ):
                    continue

                record_id = self._compute_chunk_id(file_info, chunk)
                records.append(
                    {
                        "id": record_id,
                        "path": chunk.path,
                        "kind": "chunk",
                        "name": f"chunk_{chunk.index}",
                        "code": chunk.content,
                        "start_byte": chunk.start_byte,
                        "end_byte": chunk.end_byte,
                        "start_line": chunk.start_line,
                        "end_line": chunk.end_line,
                        "pattern": None,
                        "symbol_kind": None,
                        "doc": None,
                        "file_hash": file_info.content_hash,
                        "indexed_at": datetime.now(),
                    }
                )

        return records

    async def _embed_and_store(self, records: list[dict[str, Any]]) -> None:
        """Embed records in batches and store them."""
        if not self.store:
            return

        # Process in embedding batches
        for i in range(0, len(records), self.embedding_batch_size):
            batch = records[i : i + self.embedding_batch_size]
            texts = [self._format_for_embedding(r) for r in batch]

            vectors = await self.embedder.embed(texts)

            for record, vector in zip(batch, vectors):
                record["vector"] = vector

            await self.store.upsert_batch(batch)

    def _format_for_embedding(self, record: dict[str, Any]) -> str:
        """Format record for embedding."""
        parts: list[str] = []
        if record.get("name"):
            parts.append(f"{record['kind']}: {record['name']}")
        if record.get("doc"):
            parts.append(record["doc"])
        parts.append(record["code"])
        return "\n".join(parts)

    def _compute_id(self, file_info: FileInfo, node: ASTNode | PatternMatch) -> str:
        """Compute unique ID for a node."""
        key = f"{file_info.path}:{node.kind}:{node.name}:{node.start_byte}"
        return hashlib.sha256(key.encode()).hexdigest()[:24]

    def _compute_chunk_id(self, file_info: FileInfo, chunk: Chunk) -> str:
        """Compute unique ID for a chunk."""
        key = f"{file_info.path}:chunk:{chunk.index}:{chunk.start_byte}"
        return hashlib.sha256(key.encode()).hexdigest()[:24]

    def _batch(self, items: list[Any], size: int) -> Iterator[list[Any]]:
        """Batch items for processing."""
        for i in range(0, len(items), size):
            yield items[i : i + size]
