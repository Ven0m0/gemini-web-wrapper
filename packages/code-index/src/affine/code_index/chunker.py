"""Sliding window chunking for fallback recall."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Chunk:
    """A text chunk for embedding."""

    path: str
    content: str
    start_byte: int
    end_byte: int
    start_line: int
    end_line: int
    index: int


class SlidingWindowChunker:
    """Chunk files with overlap for semantic search fallback."""

    def __init__(self, chunk_size: int = 800, overlap: int = 200):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk_file(self, path: str, content: str) -> list[Chunk]:
        """Split file into overlapping chunks."""
        lines = content.split("\n")
        if not lines:
            return []

        chunks: list[Chunk] = []
        start_line = 0
        chunk_index = 0

        while start_line < len(lines):
            chunk_lines, end_line = self._build_chunk(lines, start_line)

            if not chunk_lines:
                break

            chunk_content = "\n".join(chunk_lines)

            # Calculate byte offsets
            start_byte = sum(len(l) + 1 for l in lines[:start_line])
            end_byte = start_byte + len(chunk_content)

            chunks.append(
                Chunk(
                    path=path,
                    content=chunk_content,
                    start_byte=start_byte,
                    end_byte=end_byte,
                    start_line=start_line + 1,
                    end_line=end_line,
                    index=chunk_index,
                )
            )

            # Move window with overlap
            next_start = self._compute_next_start(start_line, end_line, chunk_index)
            if next_start <= start_line:
                next_start = end_line
            start_line = next_start
            chunk_index += 1

        return chunks

    def _build_chunk(self, lines: list[str], start_line: int) -> tuple[list[str], int]:
        """Build a single chunk from lines starting at start_line."""
        chunk_lines: list[str] = []
        char_count = 0
        end_line = start_line

        while end_line < len(lines):
            line = lines[end_line]
            line_len = len(line)

            # Check if adding this line would exceed chunk size
            if char_count + line_len > self.chunk_size and chunk_lines:
                break

            chunk_lines.append(line)
            char_count += line_len + 1  # +1 for newline
            end_line += 1

            # Single line case: if line is huge, take it anyway
            if not chunk_lines:
                chunk_lines.append(line)
                end_line += 1
                break

        return chunk_lines, end_line

    def _compute_next_start(
        self, start_line: int, end_line: int, chunk_index: int
    ) -> int:
        """Compute next start line with overlap."""
        # Estimate lines from overlap chars
        avg_line_len = max(1, self.chunk_size // 20)  # Rough estimate
        overlap_lines = max(1, self.overlap // avg_line_len)

        next_start = end_line - overlap_lines
        min_progress = start_line + max(
            1, (self.chunk_size - self.overlap) // avg_line_len
        )

        if next_start < min_progress:
            next_start = end_line

        return max(next_start, start_line + 1)
