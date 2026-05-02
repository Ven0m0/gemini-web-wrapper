from affine.code_index.chunker import SlidingWindowChunker


def test_empty_content():
    chunker = SlidingWindowChunker(chunk_size=100, overlap=20)
    chunks = chunker.chunk_file("test.py", "")
    assert chunks == []


def test_small_content():
    chunker = SlidingWindowChunker(chunk_size=100, overlap=20)
    content = "print('hello')"
    chunks = chunker.chunk_file("test.py", content)

    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.path == "test.py"
    assert chunk.content == content
    assert chunk.start_line == 1
    assert chunk.end_line == 1
    assert chunk.start_byte == 0
    assert chunk.end_byte == len(content)
    assert chunk.index == 0


def test_multiple_chunks():
    # Use small chunk size to force multiple chunks
    chunker = SlidingWindowChunker(chunk_size=20, overlap=5)
    content = "line1\nline2\nline3\nline4\nline5"

    chunks = chunker.chunk_file("test.py", content)
    assert len(chunks) > 1

    # Verify indexes
    for i, chunk in enumerate(chunks):
        assert chunk.index == i
        assert chunk.path == "test.py"


def test_overlap_logic():
    # To ensure overlap with the current heuristic:
    # avg_line_len = 1000 // 20 = 50
    # overlap_lines = 500 // 50 = 10
    # min_progress = start_line + (1000 - 500) // 50 = start_line + 10
    # We need a chunk to have MORE than 10 lines to have overlap.
    # If lines are 20 chars, a 1000 char chunk will have ~50 lines.
    # 50 - 10 = 40. 40 >= 10. So next_start = 40. Overlap will be 10 lines.

    chunker = SlidingWindowChunker(chunk_size=1000, overlap=500)
    lines = [f"Line {i:03d} content here..." for i in range(100)]  # ~25 chars per line
    content = "\n".join(lines)
    chunks = chunker.chunk_file("test.txt", content)

    assert len(chunks) > 1
    # Check if there is overlap between first and second chunk
    if len(chunks) >= 2:
        # Check if some line from chunk 0 is in chunk 1
        lines_c0 = set(chunks[0].content.split("\n"))
        lines_c1 = set(chunks[1].content.split("\n"))
        assert lines_c0.intersection(lines_c1), "Chunks should overlap"


def test_huge_line():
    chunker = SlidingWindowChunker(chunk_size=10, overlap=2)
    content = "This is a very long line that exceeds the chunk size\nShort line"
    chunks = chunker.chunk_file("test.txt", content)

    assert len(chunks) >= 2
    assert chunks[0].content == "This is a very long line that exceeds the chunk size"
    assert chunks[0].start_line == 1
    assert chunks[0].end_line == 1


def test_byte_offsets():
    chunker = SlidingWindowChunker(chunk_size=100, overlap=20)
    content = "abc\ndef\nghi\njkl\nmno\npqr\nstu\nvwx\nyz"
    chunks = chunker.chunk_file("test.txt", content)

    for chunk in chunks:
        assert content[chunk.start_byte : chunk.end_byte] == chunk.content
