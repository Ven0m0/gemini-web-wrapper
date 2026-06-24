from __future__ import annotations

import asyncio
import base64
import hashlib
import logging
import shutil
import sqlite3
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol
from urllib.parse import quote

import httpx
import libsql
import tree_sitter_bash as tree_sitter_bash
import tree_sitter_python as tree_sitter_python
import tree_sitter_rust as tree_sitter_rust
from ast_grep_py import SgRoot
from tree_sitter import Language, Node, Parser

from affine.config.settings import Settings
from affine.shared.repo_index_schemas import (
    RepoIndexRequest,
    RepoIndexStatus,
    RepoSearchRequest,
    RepoSearchResponse,
    RepoSearchResult,
)

TEXT_FILE_EXTENSIONS = {
    ".bash",
    ".c",
    ".cc",
    ".cfg",
    ".conf",
    ".cpp",
    ".css",
    ".csv",
    ".go",
    ".h",
    ".html",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".py",
    ".rb",
    ".rs",
    ".sh",
    ".sql",
    ".svg",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
}

TEXT_FILE_NAMES = {
    ".gitignore",
    ".env.example",
    "Dockerfile",
    "Justfile",
    "Makefile",
}

LANGUAGE_BY_EXTENSION = {
    ".bash": "bash",
    ".py": "python",
    ".rs": "rust",
    ".sh": "bash",
}

TREE_SITTER_LANGUAGES = {
    "bash": Language(tree_sitter_bash.language()),
    "python": Language(tree_sitter_python.language()),
    "rust": Language(tree_sitter_rust.language()),
}

TREE_SITTER_KINDS: dict[str, dict[str, str]] = {
    "bash": {
        "function_definition": "function",
    },
    "python": {
        "class_definition": "class",
        "function_definition": "function",
    },
    "rust": {
        "enum_item": "enum",
        "function_item": "function",
        "impl_item": "impl",
        "mod_item": "module",
        "struct_item": "struct",
        "trait_item": "trait",
    },
}

AST_GREP_PATTERNS: dict[str, list[tuple[str, str, str]]] = {
    "bash": [
        ("function", "function $NAME() { $$$BODY }", "NAME"),
        ("function", "$NAME() { $$$BODY }", "NAME"),
    ],
    "python": [
        ("class", "class $NAME($$$ARGS): $$$BODY", "NAME"),
        ("class", "class $NAME: $$$BODY", "NAME"),
        ("function", "def $NAME($$$ARGS): $$$BODY", "NAME"),
    ],
    "rust": [
        ("enum", "enum $NAME { $$$BODY }", "NAME"),
        ("function", "fn $NAME($$$ARGS) { $$$BODY }", "NAME"),
        ("function", "pub fn $NAME($$$ARGS) { $$$BODY }", "NAME"),
        ("impl", "impl $NAME { $$$BODY }", "NAME"),
        ("module", "mod $NAME { $$$BODY }", "NAME"),
        ("struct", "struct $NAME { $$$BODY }", "NAME"),
        ("trait", "trait $NAME { $$$BODY }", "NAME"),
    ],
}

logger = logging.getLogger(__name__)


class CursorLike(Protocol):
    def fetchone(self) -> tuple[object, ...] | None: ...

    def fetchall(self) -> list[tuple[object, ...]]: ...


class ConnectionLike(Protocol):
    def execute(self, sql: str, parameters: tuple[object, ...] = ()) -> CursorLike: ...

    def executemany(
        self, sql: str, parameters: Iterable[tuple[object, ...]]
    ) -> CursorLike: ...

    def commit(self) -> None: ...

    def close(self) -> None: ...


@dataclass(frozen=True)
class GitHubTreeEntry:
    path: str
    sha: str
    size: int


@dataclass(frozen=True)
class IndexedSymbol:
    kind: str
    name: str
    start_line: int
    end_line: int
    snippet: str


@dataclass(frozen=True)
class IndexedFile:
    path: str
    sha: str
    language: str | None
    line_count: int
    size: int
    content_hash: str
    snippet: str
    symbols: list[IndexedSymbol]


class GitHubRepositoryClient:
    def __init__(self, *, token: str, owner: str, repo: str) -> None:
        self._token = token
        self._owner = owner
        self._repo = repo
        self._timeout = httpx.Timeout(30.0)

    async def _get_json(self, endpoint: str) -> dict[str, object]:
        url = f"https://api.github.com/repos/{self._owner}/{self._repo}/{endpoint}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url,
                headers={
                    "Accept": "application/vnd.github+json",
                    "Authorization": f"Bearer {self._token}",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("Unexpected GitHub API response")
        return payload

    async def list_tree(self, branch: str) -> list[GitHubTreeEntry]:
        branch_data = await self._get_json(f"branches/{quote(branch, safe='')}")
        commit = branch_data.get("commit")
        if not isinstance(commit, dict):
            raise ValueError("GitHub branch response missing commit metadata")
        commit_commit = commit.get("commit")
        if not isinstance(commit_commit, dict):
            raise ValueError("GitHub branch response missing tree metadata")
        tree_info = commit_commit.get("tree")
        if not isinstance(tree_info, dict):
            raise ValueError("GitHub branch response missing tree sha")
        tree_sha = tree_info.get("sha")
        if not isinstance(tree_sha, str) or not tree_sha:
            raise ValueError("GitHub branch response missing tree sha")

        tree_data = await self._get_json(f"git/trees/{tree_sha}?recursive=1")
        entries = tree_data.get("tree")
        if not isinstance(entries, list):
            raise ValueError("GitHub tree response missing entries")

        output: list[GitHubTreeEntry] = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            if entry.get("type") != "blob":
                continue
            path = entry.get("path")
            sha = entry.get("sha")
            size = entry.get("size")
            if not isinstance(path, str) or not isinstance(sha, str):
                continue
            output.append(
                GitHubTreeEntry(
                    path=path,
                    sha=sha,
                    size=size if isinstance(size, int) else 0,
                )
            )
        return output

    async def get_blob_text(self, sha: str) -> str:
        blob = await self._get_json(f"git/blobs/{sha}")
        encoding = blob.get("encoding")
        content = blob.get("content")
        if encoding != "base64" or not isinstance(content, str):
            raise ValueError(f"Unsupported blob encoding for {sha}")
        decoded = base64.b64decode(content.encode("utf-8"), validate=False)
        return decoded.decode("utf-8")


class RepositoryIndexService:
    def __init__(
        self,
        settings: Settings,
        client_factory: Callable[[RepoIndexRequest], GitHubRepositoryClient]
        | None = None,
    ) -> None:
        self._settings = settings
        self._client_factory = client_factory or self._default_client_factory
        self._parser_cache: dict[str, Parser] = {}

    async def index_repository(self, request: RepoIndexRequest) -> RepoIndexStatus:
        if not self._settings.repo_index_enabled:
            raise ValueError("Repository indexing is disabled")

        existing_status = self.get_status(
            owner=request.owner,
            repo=request.repo,
            branch=request.branch,
        )
        if (
            existing_status is not None
            and existing_status.status == "indexed"
            and not request.force
        ):
            return existing_status

        max_files = request.max_files or self._settings.repo_index_max_files
        lsp_servers = self._detect_lsp_servers()
        client = self._client_factory(request)
        connection = self._connect()

        try:
            loop = asyncio.get_running_loop()

            def _init_db() -> None:
                self._init_schema(connection)
                self._upsert_status(
                    connection,
                    owner=request.owner,
                    repo=request.repo,
                    branch=request.branch,
                    status="indexing",
                    indexed_files=0,
                    skipped_files=0,
                    symbol_count=0,
                    last_error=None,
                    lsp_servers=lsp_servers,
                )
                connection.commit()

            await loop.run_in_executor(None, _init_db)

            tree = await client.list_tree(request.branch)
            text_entries = [
                entry
                for entry in sorted(tree, key=lambda item: item.path)
                if self._should_index_path(entry.path, entry.size)
            ]
            selected_entries = text_entries[:max_files]
            skipped_files = max(0, len(text_entries) - len(selected_entries))

            def _clear_db() -> int:
                rid = self._repo_id(
                    connection,
                    owner=request.owner,
                    repo=request.repo,
                    branch=request.branch,
                )
                if rid is None:
                    raise ValueError("Failed to initialise repository index")
                self._clear_repo_rows(connection, rid)
                return rid

            repo_id = await loop.run_in_executor(None, _clear_db)

            semaphore = asyncio.Semaphore(50)

            async def fetch_entry(
                entry: GitHubTreeEntry,
            ) -> tuple[GitHubTreeEntry, str | None]:
                async with semaphore:
                    try:
                        content = await client.get_blob_text(entry.sha)
                        return entry, content
                    except UnicodeDecodeError:
                        return entry, None

            fetch_tasks = [fetch_entry(entry) for entry in selected_entries]
            fetch_results = await asyncio.gather(*fetch_tasks)

            index_tasks = []
            for entry, blob_content in fetch_results:
                if blob_content is None:
                    skipped_files += 1
                    continue
                index_tasks.append(
                    loop.run_in_executor(None, self._index_file, entry, blob_content)
                )
            indexed_results: list[IndexedFile] = list(
                await asyncio.gather(*index_tasks)
            )

            def _insert_and_commit() -> RepoIndexStatus:
                self._insert_files(connection, repo_id, indexed_results)
                indexed_files = len(indexed_results)
                symbol_count = sum(len(f.symbols) for f in indexed_results)

                self._upsert_status(
                    connection,
                    owner=request.owner,
                    repo=request.repo,
                    branch=request.branch,
                    status="indexed",
                    indexed_files=indexed_files,
                    skipped_files=skipped_files,
                    symbol_count=symbol_count,
                    last_error=None,
                    lsp_servers=lsp_servers,
                )
                connection.commit()
                status_res = self.get_status(
                    owner=request.owner,
                    repo=request.repo,
                    branch=request.branch,
                    connection=connection,
                )
                if status_res is None:
                    raise ValueError("Repository index was not persisted")
                return status_res

            status_result = await loop.run_in_executor(None, _insert_and_commit)
            return status_result
        except Exception as exc:
            error_msg = str(exc)

            def _handle_error() -> None:
                self._upsert_status(
                    connection,
                    owner=request.owner,
                    repo=request.repo,
                    branch=request.branch,
                    status="error",
                    indexed_files=0,
                    skipped_files=0,
                    symbol_count=0,
                    last_error=error_msg,
                    lsp_servers=lsp_servers,
                )
                connection.commit()

            try:
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, _handle_error)
            except Exception:
                _handle_error()

            raise
        finally:
            connection.close()

    def get_status(
        self,
        *,
        owner: str,
        repo: str,
        branch: str,
        connection: ConnectionLike | None = None,
    ) -> RepoIndexStatus | None:
        local_connection = connection or self._connect()
        should_close = connection is None
        try:
            self._init_schema(local_connection)
            row = local_connection.execute(
                """
                SELECT owner, repo, branch, status, indexed_files, skipped_files,
                       symbol_count, last_indexed_at, last_error, lsp_servers
                FROM repo_index
                WHERE owner = ? AND repo = ? AND branch = ?
                """,
                (owner, repo, branch),
            ).fetchone()
            if row is None:
                return None
            last_indexed_at = row[7]
            parsed_last_indexed_at = None
            if isinstance(last_indexed_at, str) and last_indexed_at:
                parsed_last_indexed_at = datetime.fromisoformat(last_indexed_at)
            lsp_servers = self._decode_lsp_servers(row[9])
            return RepoIndexStatus(
                owner=str(row[0]),
                repo=str(row[1]),
                branch=str(row[2]),
                status=str(row[3]),
                indexed_files=self._as_int(row[4]),
                skipped_files=self._as_int(row[5]),
                symbol_count=self._as_int(row[6]),
                last_indexed_at=parsed_last_indexed_at,
                last_error=str(row[8]) if row[8] is not None else None,
                lsp_servers=lsp_servers,
            )
        finally:
            if should_close:
                local_connection.close()

    def search_repository(self, request: RepoSearchRequest) -> RepoSearchResponse:
        connection = self._connect()
        try:
            self._init_schema(connection)
            status_result = self.get_status(
                owner=request.owner,
                repo=request.repo,
                branch=request.branch,
                connection=connection,
            )
            if status_result is None or status_result.status != "indexed":
                return RepoSearchResponse(
                    owner=request.owner,
                    repo=request.repo,
                    branch=request.branch,
                    query=request.query,
                    indexed=False,
                    results=[],
                )

            repo_id = self._repo_id(
                connection,
                owner=request.owner,
                repo=request.repo,
                branch=request.branch,
            )
            if repo_id is None:
                return RepoSearchResponse(
                    owner=request.owner,
                    repo=request.repo,
                    branch=request.branch,
                    query=request.query,
                    indexed=False,
                    results=[],
                )

            path_prefix = request.path.strip().lower() if request.path else ""
            sql = """
                SELECT f.path, f.language, s.kind, s.name, s.start_line, s.end_line,
                       s.snippet, f.snippet,
                       LOWER(f.path), LOWER(s.name), LOWER(s.kind),
                       LOWER(COALESCE(NULLIF(s.snippet, ''), f.snippet, ''))
                FROM indexed_symbol AS s
                INNER JOIN indexed_file AS f ON f.id = s.file_id
                WHERE s.repo_index_id = ?
            """
            params: list[object] = [repo_id]
            if path_prefix:
                sql += " AND LOWER(f.path) LIKE ? || '%'"
                params.append(path_prefix)
            sql += " ORDER BY f.path ASC, s.start_line ASC"

            results = self._rank_search_results(
                rows=connection.execute(sql, tuple(params)).fetchall(),
                query=request.query,
                path_prefix=request.path,
                limit=request.limit,
            )
            return RepoSearchResponse(
                owner=request.owner,
                repo=request.repo,
                branch=request.branch,
                query=request.query,
                indexed=True,
                results=results,
            )
        finally:
            connection.close()

    def _index_file(self, entry: GitHubTreeEntry, content: str) -> IndexedFile:
        normalized_content = content.replace("\r\n", "\n")
        lines = normalized_content.split("\n")
        language = self._detect_language(entry.path)
        symbols = self._extract_symbols(normalized_content, language)
        return IndexedFile(
            path=entry.path,
            sha=entry.sha,
            language=language,
            line_count=len(lines),
            size=len(normalized_content.encode("utf-8")),
            content_hash=hashlib.sha256(normalized_content.encode("utf-8")).hexdigest(),
            snippet=self._make_snippet(normalized_content, 1, min(len(lines), 20)),
            symbols=symbols,
        )

    def _extract_symbols(
        self, content: str, language: str | None
    ) -> list[IndexedSymbol]:
        if language is None:
            return []
        seen: set[tuple[str, int, int]] = set()
        collected: list[IndexedSymbol] = []
        for symbol in self._extract_ast_grep_symbols(content, language):
            key = (symbol.name, symbol.start_line, symbol.end_line)
            if key in seen:
                continue
            seen.add(key)
            collected.append(symbol)
        for symbol in self._extract_tree_sitter_symbols(content, language):
            key = (symbol.name, symbol.start_line, symbol.end_line)
            if key in seen:
                continue
            seen.add(key)
            collected.append(symbol)
        return sorted(collected, key=lambda item: (item.start_line, item.name))

    def _extract_ast_grep_symbols(
        self, content: str, language: str
    ) -> list[IndexedSymbol]:
        patterns = AST_GREP_PATTERNS.get(language, [])
        if not patterns:
            return []
        try:
            root = SgRoot(content, language)
            node = root.root()
        except Exception:
            logger.warning("Failed to parse content with ast_grep", exc_info=True)
            return []

        symbols: list[IndexedSymbol] = []
        for kind, pattern, capture in patterns:
            try:
                matches = node.find_all(pattern=pattern)
            except Exception:
                logger.warning("Failed to find ast_grep pattern matches", exc_info=True)
                continue
            for match in matches:
                name_node = match.get_match(capture)
                if name_node is None:
                    continue
                range_info = match.range()
                start_line = range_info.start.line + 1
                end_line = range_info.end.line + 1
                symbols.append(
                    IndexedSymbol(
                        kind=kind,
                        name=name_node.text(),
                        start_line=start_line,
                        end_line=max(start_line, end_line),
                        snippet=self._make_snippet(content, start_line, end_line),
                    )
                )
        return symbols

    def _extract_tree_sitter_symbols(
        self, content: str, language: str
    ) -> list[IndexedSymbol]:
        parser = self._get_parser(language)
        content_bytes = content.encode("utf-8")
        tree = parser.parse(content_bytes)
        if tree is None:
            return []

        kinds = TREE_SITTER_KINDS.get(language, {})
        symbols: list[IndexedSymbol] = []
        for node in self._walk_tree(tree.root_node):
            kind = kinds.get(node.type)
            if kind is None:
                continue
            name = self._extract_node_name(node, content_bytes)
            if not name:
                continue
            start_line = node.start_point[0] + 1
            end_line = node.end_point[0] + 1
            symbols.append(
                IndexedSymbol(
                    kind=kind,
                    name=name,
                    start_line=start_line,
                    end_line=max(start_line, end_line),
                    snippet=self._make_snippet(content, start_line, end_line),
                )
            )
        return symbols

    def _extract_node_name(self, node: Node, content_bytes: bytes) -> str:
        for field_name in ("name", "type", "trait"):
            child = node.child_by_field_name(field_name)
            if child is not None:
                return self._node_text(child, content_bytes)
        for child in node.children:
            if child.type in {
                "identifier",
                "name",
                "type_identifier",
                "field_identifier",
                "scoped_identifier",
            }:
                return self._node_text(child, content_bytes)
        return self._node_text(node, content_bytes).split("\n", 1)[0][:80]

    def _node_text(self, node: Node, content_bytes: bytes) -> str:
        return content_bytes[node.start_byte : node.end_byte].decode("utf-8").strip()

    def _walk_tree(self, node: Node) -> Iterable[Node]:
        yield node
        for child in node.children:
            yield from self._walk_tree(child)

    def _get_parser(self, language: str) -> Parser:
        cached = self._parser_cache.get(language)
        if cached is not None:
            return cached
        parser = Parser(TREE_SITTER_LANGUAGES[language])
        self._parser_cache[language] = parser
        return parser

    def _make_snippet(self, content: str, start_line: int, end_line: int) -> str:
        lines = content.split("\n")
        start_index = max(0, start_line - 2)
        end_index = min(len(lines), end_line + 1)
        snippet_lines = lines[start_index:end_index]
        return "\n".join(snippet_lines).strip()

    def _detect_language(self, path: str) -> str | None:
        if path in TEXT_FILE_NAMES:
            return None
        return LANGUAGE_BY_EXTENSION.get(Path(path).suffix.lower())

    def _should_index_path(self, path: str, size: int) -> bool:
        if size > self._settings.repo_index_max_file_bytes:
            return False
        file_name = Path(path).name
        if file_name in TEXT_FILE_NAMES:
            return True
        return Path(path).suffix.lower() in TEXT_FILE_EXTENSIONS

    def _rank_search_results(
        self,
        *,
        rows: list[tuple[object, ...]],
        query: str,
        path_prefix: str | None,
        limit: int,
    ) -> list[RepoSearchResult]:
        query_text = query.strip().lower()
        tokens = [token for token in query_text.split() if token]
        if not tokens:
            return []

        results: list[RepoSearchResult] = []
        normalized_prefix = path_prefix.strip().lower() if path_prefix else ""
        for row in rows:
            path = str(row[0])
            if normalized_prefix and not path.lower().startswith(normalized_prefix):
                continue
            name = str(row[3])
            kind = str(row[2])
            snippet = str(row[6] or row[7] or "")
            haystacks = {
                "path": str(row[8]),
                "name": str(row[9]),
                "kind": str(row[10]),
                "snippet": str(row[11]),
            }
            score = self._score_match(tokens, haystacks)
            if score <= 0:
                continue
            results.append(
                RepoSearchResult(
                    path=path,
                    language=str(row[1]) if row[1] is not None else None,
                    kind=kind,
                    name=name,
                    start_line=self._as_int(row[4]),
                    end_line=self._as_int(row[5]),
                    score=round(score, 3),
                    snippet=snippet,
                )
            )
        results.sort(
            key=lambda item: (-item.score, item.path, item.start_line, item.name)
        )
        return results[:limit]

    def _score_match(self, tokens: list[str], haystacks: dict[str, str]) -> float:
        score = 0.0
        for token in tokens:
            if token in haystacks["name"]:
                score += 4.0
            if token in haystacks["kind"]:
                score += 2.5
            if token in haystacks["path"]:
                score += 1.5
            if token in haystacks["snippet"]:
                score += 1.0
        query_text = " ".join(tokens)
        if query_text and query_text in haystacks["name"]:
            score += 2.0
        return score

    def _connect(self) -> ConnectionLike:
        db_path = self._settings.repo_index_db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        if not self._settings.repo_index_turso_sync_url:
            return sqlite3.connect(str(db_path), check_same_thread=False)
        connect_kwargs: dict[str, str] = {}
        if self._settings.repo_index_turso_sync_url:
            connect_kwargs["sync_url"] = self._settings.repo_index_turso_sync_url
        if self._settings.repo_index_turso_auth_token:
            connect_kwargs["auth_token"] = self._settings.repo_index_turso_auth_token
        connect_fn = getattr(libsql, "connect", None)
        if not callable(connect_fn):
            raise ValueError("libsql.connect is unavailable")
        connection = connect_fn(str(db_path), **connect_kwargs)
        sync = getattr(connection, "sync", None)
        if callable(sync) and self._settings.repo_index_turso_sync_url:
            sync()
        return connection

    def _init_schema(self, connection: ConnectionLike) -> None:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS repo_index (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner TEXT NOT NULL,
                repo TEXT NOT NULL,
                branch TEXT NOT NULL,
                status TEXT NOT NULL,
                indexed_files INTEGER NOT NULL DEFAULT 0,
                skipped_files INTEGER NOT NULL DEFAULT 0,
                symbol_count INTEGER NOT NULL DEFAULT 0,
                last_indexed_at TEXT,
                last_error TEXT,
                lsp_servers TEXT NOT NULL DEFAULT '',
                UNIQUE(owner, repo, branch)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS indexed_file (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repo_index_id INTEGER NOT NULL,
                path TEXT NOT NULL,
                sha TEXT NOT NULL,
                language TEXT,
                line_count INTEGER NOT NULL,
                size INTEGER NOT NULL,
                snippet TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                UNIQUE(repo_index_id, path)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS indexed_symbol (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repo_index_id INTEGER NOT NULL,
                file_id INTEGER NOT NULL,
                kind TEXT NOT NULL,
                name TEXT NOT NULL,
                start_line INTEGER NOT NULL,
                end_line INTEGER NOT NULL,
                snippet TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_indexed_symbol_repo ON indexed_symbol(repo_index_id)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_indexed_file_repo ON indexed_file(repo_index_id)"
        )
        connection.commit()

    def _clear_repo_rows(self, connection: ConnectionLike, repo_id: int) -> None:
        connection.execute(
            "DELETE FROM indexed_symbol WHERE repo_index_id = ?",
            (repo_id,),
        )
        connection.execute(
            "DELETE FROM indexed_file WHERE repo_index_id = ?",
            (repo_id,),
        )

    def _insert_files(
        self,
        connection: ConnectionLike,
        repo_id: int,
        indexed_files: list[IndexedFile],
    ) -> None:
        if not indexed_files:
            return

        connection.executemany(
            """
            INSERT INTO indexed_file (
                repo_index_id, path, sha, language, line_count, size, snippet, content_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    repo_id,
                    indexed.path,
                    indexed.sha,
                    indexed.language,
                    indexed.line_count,
                    indexed.size,
                    indexed.snippet,
                    indexed.content_hash,
                )
                for indexed in indexed_files
            ],
        )

        file_id_map: dict[str, int] = {
            str(row[0]): self._as_int(row[1])
            for row in connection.execute(
                "SELECT path, id FROM indexed_file WHERE repo_index_id = ?",
                (repo_id,),
            ).fetchall()
        }

        symbol_params: list[tuple[object, ...]] = []
        for indexed in indexed_files:
            file_id = file_id_map.get(indexed.path)
            if file_id is None:
                raise ValueError(f"Failed to persist indexed file for {indexed.path}")
            for symbol in indexed.symbols:
                symbol_params.append(
                    (
                        repo_id,
                        file_id,
                        symbol.kind,
                        symbol.name,
                        symbol.start_line,
                        symbol.end_line,
                        symbol.snippet,
                    )
                )

        if symbol_params:
            connection.executemany(
                """
                INSERT INTO indexed_symbol (
                    repo_index_id, file_id, kind, name, start_line, end_line, snippet
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                symbol_params,
            )

    def _upsert_status(
        self,
        connection: ConnectionLike,
        *,
        owner: str,
        repo: str,
        branch: str,
        status: str,
        indexed_files: int,
        skipped_files: int,
        symbol_count: int,
        last_error: str | None,
        lsp_servers: dict[str, bool],
    ) -> None:
        timestamp = datetime.now(UTC).isoformat()
        connection.execute(
            """
            INSERT INTO repo_index (
                owner, repo, branch, status, indexed_files, skipped_files,
                symbol_count, last_indexed_at, last_error, lsp_servers
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(owner, repo, branch)
            DO UPDATE SET
                status = excluded.status,
                indexed_files = excluded.indexed_files,
                skipped_files = excluded.skipped_files,
                symbol_count = excluded.symbol_count,
                last_indexed_at = excluded.last_indexed_at,
                last_error = excluded.last_error,
                lsp_servers = excluded.lsp_servers
            """,
            (
                owner,
                repo,
                branch,
                status,
                indexed_files,
                skipped_files,
                symbol_count,
                timestamp,
                last_error,
                self._encode_lsp_servers(lsp_servers),
            ),
        )

    def _repo_id(
        self,
        connection: ConnectionLike,
        *,
        owner: str,
        repo: str,
        branch: str,
    ) -> int | None:
        row = connection.execute(
            "SELECT id FROM repo_index WHERE owner = ? AND repo = ? AND branch = ?",
            (owner, repo, branch),
        ).fetchone()
        if row is None:
            return None
        return self._as_int(row[0])

    def _encode_lsp_servers(self, lsp_servers: dict[str, bool]) -> str:
        return ";".join(
            f"{language}={'1' if enabled else '0'}"
            for language, enabled in sorted(lsp_servers.items())
        )

    def _decode_lsp_servers(self, encoded: object) -> dict[str, bool]:
        if not isinstance(encoded, str) or not encoded:
            return {}
        output: dict[str, bool] = {}
        for part in encoded.split(";"):
            language, _, enabled = part.partition("=")
            if not language:
                continue
            output[language] = enabled == "1"
        return output

    def _detect_lsp_servers(self) -> dict[str, bool]:
        return {
            "bash": shutil.which(self._settings.repo_index_bash_lsp_command)
            is not None,
            "python": shutil.which(self._settings.repo_index_python_lsp_command)
            is not None,
            "rust": shutil.which(self._settings.repo_index_rust_lsp_command)
            is not None,
        }

    def _default_client_factory(
        self, request: RepoIndexRequest
    ) -> GitHubRepositoryClient:
        return GitHubRepositoryClient(
            token=request.github_token,
            owner=request.owner,
            repo=request.repo,
        )

    def _as_int(self, value: object) -> int:
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        if isinstance(value, str):
            return int(value)
        raise ValueError(f"Expected integer-compatible value, got {type(value)!r}")
