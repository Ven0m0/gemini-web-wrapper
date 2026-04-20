"""Affine Code Index - LanceDB + AST-aware code indexing."""

from __future__ import annotations

from .chunker import Chunk, SlidingWindowChunker
from .discovery import FileDiscovery, FileInfo
from .embedder import (
    Embedder,
    EmbedderFactory,
    GeminiEmbedder,
    LocalEmbedder,
    OpenAIEmbedder,
    normalize_l2,
)
from .indexer import CodeIndexer
from .parser import ASTNode, ASTParser, PatternMatch
from .search import CodeSearchEngine, SearchResult
from .store import CodeIndexStore

__all__ = [
    # Embedder
    "Embedder",
    "EmbedderFactory",
    "OpenAIEmbedder",
    "GeminiEmbedder",
    "LocalEmbedder",
    "normalize_l2",
    # Parser
    "ASTNode",
    "PatternMatch",
    "ASTParser",
    # Chunker
    "Chunk",
    "SlidingWindowChunker",
    # Discovery
    "FileInfo",
    "FileDiscovery",
    # Store
    "CodeIndexStore",
    # Indexer
    "CodeIndexer",
    # Search
    "CodeSearchEngine",
    "SearchResult",
]
