"""LanceDB storage for code embeddings."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pyarrow as pa


class CodeIndexStore:
    """Manages LanceDB table for code embeddings."""

    TABLE_NAME = "code_index"

    def __init__(self, db_path: Path, embedding_dim: int):
        self.db_path = db_path
        self.embedding_dim = embedding_dim
        self._db: Any = None
        self._table: Any = None

    @staticmethod
    def _escape_sql_string(s: str) -> str:
        """Escape single quotes for DataFusion/SQL injection prevention."""
        return s.replace("'", "''")

    @staticmethod
    def _escape_like_string(s: str) -> str:
        """Escape characters for LIKE clause including wildcards."""
        s = CodeIndexStore._escape_sql_string(s)
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    def _get_schema(self) -> pa.Schema:
        """Build schema with correct embedding dimension."""
        return pa.schema(
            [
                ("id", pa.string()),
                ("path", pa.string()),
                ("kind", pa.string()),
                ("name", pa.string()),
                ("signature", pa.string()),
                ("code", pa.string()),
                ("start_byte", pa.int64()),
                ("end_byte", pa.int64()),
                ("start_line", pa.int64()),
                ("end_line", pa.int64()),
                ("vector", pa.list_(pa.float32(), self.embedding_dim)),
                ("pattern", pa.string()),
                ("symbol_kind", pa.string()),
                ("doc", pa.string()),
                ("file_hash", pa.string()),
                ("indexed_at", pa.timestamp("us")),
            ]
        )

    async def initialize(self) -> None:
        """Open/create database and table."""
        import lancedb

        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db = await lancedb.connect_async(str(self.db_path))

        # Create table if not exists
        try:
            self._table = await self._db.open_table(self.TABLE_NAME)
        except Exception:
            # Create with schema
            schema = self._get_schema()
            self._table = await self._db.create_table(
                self.TABLE_NAME,
                schema=schema,
                mode="create",
            )

    async def upsert_batch(self, records: list[dict[str, Any]]) -> None:
        """Batch insert/update records."""
        if not records or self._table is None:
            return

        # Deduplicate by id
        seen: set[str] = set()
        unique_records: list[dict[str, Any]] = []
        for record in records:
            record_id = record["id"]
            if record_id not in seen:
                seen.add(record_id)
                unique_records.append(record)

        await self._table.add(unique_records, mode="upsert")

    async def search(
        self,
        query_vector: list[float],
        k: int = 10,
        path_filter: str | None = None,
        kind_filter: str | None = None,
        exclude_chunks: bool = False,
    ) -> list[dict[str, Any]]:
        """Semantic search with optional filters."""
        if self._table is None:
            raise RuntimeError("Store not initialized")

        # Build query
        query = self._table.search(query_vector).metric("cosine")

        # Build where clause
        conditions: list[str] = []
        if path_filter:
            conditions.append(f"path LIKE '{self._escape_like_string(path_filter)}%'")
        if kind_filter:
            conditions.append(f"kind = '{self._escape_sql_string(kind_filter)}'")
        if exclude_chunks:
            conditions.append("kind != 'chunk'")

        if conditions:
            where_clause = " AND ".join(conditions)
            query = query.where(where_clause)

        results = await query.limit(k).to_list()
        return results

    async def search_structural(
        self,
        kind: str | None = None,
        name_pattern: str | None = None,
        code_pattern: str | None = None,
        path_prefix: str | None = None,
        k: int = 10,
    ) -> list[dict[str, Any]]:
        """Structural search by kind, name, and code (without vector search)."""
        if self._table is None:
            raise RuntimeError("Store not initialized")

        # Build query without vector
        query = self._table.query()

        # Build where clause
        conditions: list[str] = []
        if kind:
            conditions.append(f"kind = '{self._escape_sql_string(kind)}'")
        if name_pattern:
            conditions.append(f"name LIKE '%{self._escape_like_string(name_pattern)}%'")
        if code_pattern:
            conditions.append(f"code LIKE '%{self._escape_like_string(code_pattern)}%'")
        if path_prefix:
            conditions.append(f"path LIKE '{self._escape_like_string(path_prefix)}%'")

        if conditions:
            where_clause = " AND ".join(conditions)
            query = query.where(where_clause)

        results = await query.limit(k).to_list()
        return results

    async def delete_by_file_hash(self, file_hash: str) -> None:
        """Remove all entries for a given file hash (for re-indexing)."""
        if self._table is None:
            return
        await self._table.delete(f"file_hash = '{self._escape_sql_string(file_hash)}'")

    async def get_indexed_file_hashes(self) -> set[str]:
        """Get all file hashes currently in index."""
        if self._table is None:
            return set()

        # Query distinct file_hashes using to_arrow
        try:
            results = await self._table.to_arrow()
            hashes = results.column("file_hash").to_pylist()
            return set(hashes)
        except Exception:
            return set()

    async def get_stats(self) -> dict[str, Any]:
        """Get index statistics."""
        if self._table is None:
            return {"total_records": 0}

        try:
            count = await self._table.count_rows()
            return {"total_records": count}
        except Exception:
            return {"total_records": 0}
