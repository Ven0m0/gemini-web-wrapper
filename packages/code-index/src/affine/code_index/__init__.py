"""Affine Code Index - LanceDB + AST-aware code indexing."""

from __future__ import annotations

from .chunker import SlidingWindowChunker
from .discovery import FileDiscovery
from .embedder import (
    Embedder,
    EmbedderFactory,
    GeminiEmbedder,
    LocalEmbedder,
    OpenAIEmbedder,
    normalize_l2,
)
from .indexer import CodeIndexer
from .parser import ASTParser
from .search import CodeSearchEngine, SearchResult
from .store import CodeIndexStore

__all__ = [
    "ASTParser",
    "CodeIndexStore",
    "CodeIndexer",
    "CodeSearchEngine",
    "Embedder",
    "EmbedderFactory",
    "FileDiscovery",
    "GeminiEmbedder",
    "LocalEmbedder",
    "OpenAIEmbedder",
    "SearchResult",
    "SlidingWindowChunker",
    "normalize_l2",
]
