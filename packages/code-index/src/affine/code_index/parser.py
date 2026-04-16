"""Tree-sitter + ast-grep based AST parsing."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

from ast_grep_py import SgRoot
from tree_sitter import Language, Node, Parser


@dataclass(frozen=True)
class ASTNode:
    """Represents a code unit extracted from AST."""

    path: str
    kind: str
    name: str
    start_byte: int
    end_byte: int
    start_line: int
    end_line: int
    code: str
    signature: str | None = None
    doc: str | None = None
    symbol_kind: str | None = None


@dataclass(frozen=True)
class PatternMatch:
    """ast-grep pattern match result."""

    path: str
    pattern: str
    kind: str = "pattern_match"
    name: str = ""
    start_byte: int = 0
    end_byte: int = 0
    start_line: int = 0
    end_line: int = 0
    code: str = ""


@dataclass
class LanguageConfig:
    """Configuration for a supported language."""

    name: str
    extensions: list[str]
    language: Language
    tree_sitter_kinds: dict[str, str]
    ast_grep_patterns: list[tuple[str, str, str]]  # (kind, pattern, capture)


class ASTParser:
    """Parse source files and extract AST nodes."""

    def __init__(self) -> None:
        self._parsers: dict[str, Parser] = {}
        self._configs: dict[str, LanguageConfig] = {}
        self._init_languages()

    def _init_languages(self) -> None:
        """Initialize language configurations."""
        try:
            import tree_sitter_python as tspython
            import tree_sitter_rust as tsrust
            import tree_sitter_bash as tsbash

            self._configs["python"] = LanguageConfig(
                name="python",
                extensions=[".py"],
                language=Language(tspython.language()),
                tree_sitter_kinds={
                    "function_definition": "function",
                    "class_definition": "class",
                    "method_definition": "method",
                },
                ast_grep_patterns=[
                    ("function", "def $NAME($$$ARGS): $$$BODY", "NAME"),
                    ("class", "class $NAME($$$ARGS): $$$BODY", "NAME"),
                    ("class", "class $NAME: $$$BODY", "NAME"),
                    ("async_function", "async def $NAME($$$ARGS): $$$BODY", "NAME"),
                ],
            )

            self._configs["rust"] = LanguageConfig(
                name="rust",
                extensions=[".rs"],
                language=Language(tsrust.language()),
                tree_sitter_kinds={
                    "function_item": "function",
                    "struct_item": "struct",
                    "enum_item": "enum",
                    "trait_item": "trait",
                    "impl_item": "impl",
                    "mod_item": "module",
                },
                ast_grep_patterns=[
                    ("function", "fn $NAME($$$ARGS) { $$$BODY }", "NAME"),
                    ("function", "pub fn $NAME($$$ARGS) { $$$BODY }", "NAME"),
                    ("async_fn", "async fn $NAME($$$ARGS) { $$$BODY }", "NAME"),
                    ("struct", "struct $NAME { $$$BODY }", "NAME"),
                    ("enum", "enum $NAME { $$$BODY }", "NAME"),
                    ("trait", "trait $NAME { $$$BODY }", "NAME"),
                    ("impl", "impl $NAME { $$$BODY }", "NAME"),
                    ("module", "mod $NAME { $$$BODY }", "NAME"),
                ],
            )

            self._configs["bash"] = LanguageConfig(
                name="bash",
                extensions=[".sh", ".bash"],
                language=Language(tsbash.language()),
                tree_sitter_kinds={
                    "function_definition": "function",
                },
                ast_grep_patterns=[
                    ("function", "function $NAME() { $$$BODY }", "NAME"),
                    ("function", "$NAME() { $$$BODY }", "NAME"),
                ],
            )

        except ImportError as exc:
            # Languages will be unavailable
            pass

        # TypeScript/JavaScript - optional
        try:
            import tree_sitter_typescript as tsts
            import tree_sitter_javascript as tsjs

            self._configs["typescript"] = LanguageConfig(
                name="typescript",
                extensions=[".ts", ".tsx"],
                language=Language(tsts.language_typescript()),
                tree_sitter_kinds={
                    "function_declaration": "function",
                    "method_definition": "method",
                    "class_declaration": "class",
                    "interface_declaration": "interface",
                    "type_alias_declaration": "type",
                    "arrow_function": "function",
                },
                ast_grep_patterns=[
                    ("function", "function $NAME($$$ARGS) { $$$BODY }", "NAME"),
                    ("function", "const $NAME = ($$$ARGS) => { $$$BODY }", "NAME"),
                    ("class", "class $NAME { $$$BODY }", "NAME"),
                    ("interface", "interface $NAME { $$$BODY }", "NAME"),
                    ("method", "$NAME($$$ARGS) { $$$BODY }", "NAME"),
                ],
            )

            self._configs["javascript"] = LanguageConfig(
                name="javascript",
                extensions=[".js", ".jsx", ".mjs"],
                language=Language(tsjs.language()),
                tree_sitter_kinds={
                    "function_declaration": "function",
                    "method_definition": "method",
                    "class_declaration": "class",
                    "arrow_function": "function",
                },
                ast_grep_patterns=[
                    ("function", "function $NAME($$$ARGS) { $$$BODY }", "NAME"),
                    ("function", "const $NAME = ($$$ARGS) => { $$$BODY }", "NAME"),
                    ("class", "class $NAME { $$$BODY }", "NAME"),
                    ("method", "$NAME($$$ARGS) { $$$BODY }", "NAME"),
                ],
            )
        except ImportError:
            pass

    def parse_file(self, path: str, content: str) -> Iterator[ASTNode | PatternMatch]:
        """Parse file and yield all AST nodes and pattern matches."""
        language = self._detect_language(path)
        if not language:
            return

        # Tree-sitter extraction
        yield from self._extract_tree_sitter_nodes(path, content, language)

        # ast-grep pattern extraction
        yield from self._extract_pattern_matches(path, content, language)

    def _detect_language(self, path: str) -> str | None:
        """Detect language from file path."""
        from pathlib import Path

        ext = Path(path).suffix.lower()
        for lang, config in self._configs.items():
            if ext in config.extensions:
                return lang
        return None

    def _get_parser(self, language: str) -> Parser:
        """Get or create parser for language."""
        if language not in self._parsers:
            config = self._configs.get(language)
            if not config:
                raise ValueError(f"Unsupported language: {language}")
            self._parsers[language] = Parser(config.language)
        return self._parsers[language]

    def _extract_tree_sitter_nodes(
        self, path: str, content: str, language: str
    ) -> Iterator[ASTNode]:
        """Extract nodes using Tree-sitter."""
        config = self._configs.get(language)
        if not config:
            return

        try:
            parser = self._get_parser(language)
            content_bytes = content.encode("utf-8")
            tree = parser.parse(content_bytes)
        except Exception:
            return

        def walk(node: Node) -> Iterator[ASTNode]:
            kind = config.tree_sitter_kinds.get(node.type)
            if kind:
                name = self._extract_node_name(node, content_bytes)
                if name:
                    # Extract docstring for Python
                    doc = None
                    if language == "python" and kind in ("function", "class", "method"):
                        doc = self._extract_python_docstring(node, content_bytes)

                    yield ASTNode(
                        path=path,
                        kind=kind,
                        name=name,
                        start_byte=node.start_byte,
                        end_byte=node.end_byte,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        code=content[node.start_byte : node.end_byte],
                        doc=doc,
                    )
            for child in node.children:
                yield from walk(child)

        yield from walk(tree.root_node)

    def _extract_pattern_matches(
        self, path: str, content: str, language: str
    ) -> Iterator[PatternMatch]:
        """Extract nodes using ast-grep patterns."""
        config = self._configs.get(language)
        if not config or not config.ast_grep_patterns:
            return

        try:
            root = SgRoot(content, language)
            node = root.root()
        except Exception:
            return

        seen: set[tuple[str, int, int]] = set()

        for pattern_kind, pattern, capture in config.ast_grep_patterns:
            try:
                matches = node.find_all(pattern=pattern)
                for match in matches:
                    name_node = match.get_match(capture)
                    if name_node is None:
                        continue

                    range_info = match.range()
                    start_line = range_info.start.line + 1
                    end_line = range_info.end.line + 1
                    key = (name_node.text(), start_line, end_line)

                    if key in seen:
                        continue
                    seen.add(key)

                    yield PatternMatch(
                        path=path,
                        pattern=pattern_kind,
                        kind="pattern_match",
                        name=name_node.text(),
                        start_line=start_line,
                        end_line=end_line,
                        code=match.text(),
                    )
            except Exception:
                continue

    def _extract_node_name(self, node: Node, content_bytes: bytes) -> str:
        """Extract name from AST node."""
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

        # Fallback: first line of node text
        return self._node_text(node, content_bytes).split("\n", 1)[0][:80]

    def _node_text(self, node: Node, content_bytes: bytes) -> str:
        """Extract text from node."""
        return content_bytes[node.start_byte : node.end_byte].decode("utf-8").strip()

    def _extract_python_docstring(self, node: Node, content_bytes: bytes) -> str | None:
        """Extract docstring from Python function/class node."""
        # Look for expression_statement containing string
        for child in node.children:
            if child.type == "block":
                for stmt in child.children:
                    if stmt.type == "expression_statement":
                        for sub in stmt.children:
                            if sub.type in ("string", "string_literal"):
                                text = self._node_text(sub, content_bytes)
                                # Clean up quotes
                                return text.strip("\"'\n ")
        return None
