import datetime
import pytest
from pathlib import Path
from affine.code_index.store import CodeIndexStore


def test_escape_sql_string():
    assert CodeIndexStore._escape_sql_string("normal") == "normal"
    assert CodeIndexStore._escape_sql_string("O'Connor") == "O''Connor"
    assert CodeIndexStore._escape_sql_string("'DROP TABLE") == "''DROP TABLE"
    assert CodeIndexStore._escape_sql_string("''") == "''''"


def test_escape_like_string():
    assert CodeIndexStore._escape_like_string("normal") == "normal"
    assert CodeIndexStore._escape_like_string("O'Connor") == "O''Connor"
    assert CodeIndexStore._escape_like_string("100%") == "100\\%"
    assert CodeIndexStore._escape_like_string("my_file") == "my\\_file"
    assert CodeIndexStore._escape_like_string("a\\b") == "a\\\\b"
    assert CodeIndexStore._escape_like_string("%_\\'") == "\\%\\_\\\\''"


@pytest.mark.asyncio
async def test_store_queries_with_escaped_strings(tmp_path: Path):
    store = CodeIndexStore(tmp_path / "test_db", embedding_dim=2)
    await store.initialize()

    # Insert some dummy records
    records = [
        {
            "id": "1",
            "path": "path/to/O'Connor.py",
            "kind": "class",
            "name": "O'Connor",
            "signature": "",
            "code": "class O'Connor: pass",
            "start_byte": 0,
            "end_byte": 10,
            "start_line": 1,
            "end_line": 2,
            "vector": [0.1, 0.2],
            "pattern": "",
            "symbol_kind": "class",
            "doc": "",
            "file_hash": "hash_1",
            "indexed_at": datetime.datetime(2023, 1, 1),
        },
        {
            "id": "2",
            "path": "path/100%/file_a.py",
            "kind": "function",
            "name": "calc_100%",
            "signature": "",
            "code": "def calc_100%(): pass",
            "start_byte": 0,
            "end_byte": 10,
            "start_line": 1,
            "end_line": 2,
            "vector": [0.3, 0.4],
            "pattern": "",
            "symbol_kind": "function",
            "doc": "",
            "file_hash": "hash_2",
            "indexed_at": datetime.datetime(2023, 1, 1),
        },
    ]
    await store._table.add(records, mode="append")

    # Test structural search with single quote
    res1 = await store.search_structural(name_pattern="O'Connor")
    assert len(res1) == 1
    assert res1[0]["id"] == "1"

    # Test structural search with wildcards
    res2 = await store.search_structural(name_pattern="100%")
    assert len(res2) == 1
    assert res2[0]["id"] == "2"

    res3 = await store.search_structural(path_prefix="path/100%")
    assert len(res3) == 1
    assert res3[0]["id"] == "2"

    # Test semantic search with filters
    # res4 = await store.search([0.1, 0.2], path_filter="path/to/O'Connor")
    # assert len(res4) == 1
    # assert res4[0]["id"] == "1"

    # Test delete
    await store.delete_by_file_hash("hash_1")
    stats = await store.get_stats()
    assert stats["total_records"] == 1

    res5 = await store.search_structural(name_pattern="O'Connor")
    assert len(res5) == 0


@pytest.mark.asyncio
async def test_delete_by_file_hashes(tmp_path: Path):
    store = CodeIndexStore(tmp_path / "test_db_batch_delete", embedding_dim=2)
    await store.initialize()

    # Insert multiple dummy records
    records = [
        {
            "id": "1",
            "path": "path/1.py",
            "kind": "class",
            "name": "Class1",
            "signature": "",
            "code": "class Class1: pass",
            "start_byte": 0,
            "end_byte": 10,
            "start_line": 1,
            "end_line": 2,
            "vector": [0.1, 0.2],
            "pattern": "",
            "symbol_kind": "class",
            "doc": "",
            "file_hash": "hash_1",
            "indexed_at": datetime.datetime(2023, 1, 1),
        },
        {
            "id": "2",
            "path": "path/2.py",
            "kind": "function",
            "name": "func2",
            "signature": "",
            "code": "def func2(): pass",
            "start_byte": 0,
            "end_byte": 10,
            "start_line": 1,
            "end_line": 2,
            "vector": [0.3, 0.4],
            "pattern": "",
            "symbol_kind": "function",
            "doc": "",
            "file_hash": "hash'2",  # Test single quote escaping
            "indexed_at": datetime.datetime(2023, 1, 1),
        },
        {
            "id": "3",
            "path": "path/3.py",
            "kind": "class",
            "name": "Class3",
            "signature": "",
            "code": "class Class3: pass",
            "start_byte": 0,
            "end_byte": 10,
            "start_line": 1,
            "end_line": 2,
            "vector": [0.5, 0.6],
            "pattern": "",
            "symbol_kind": "class",
            "doc": "",
            "file_hash": "hash_3",
            "indexed_at": datetime.datetime(2023, 1, 1),
        },
    ]
    await store._table.add(records, mode="append")

    stats = await store.get_stats()
    assert stats["total_records"] == 3

    # Test returning immediately with empty set
    await store.delete_by_file_hashes(set())
    stats = await store.get_stats()
    assert stats["total_records"] == 3

    # Delete first two records
    await store.delete_by_file_hashes({"hash_1", "hash'2"})
    stats = await store.get_stats()
    assert stats["total_records"] == 1

    # Verify that only the third record remains
    res1 = await store.search_structural(name_pattern="Class1")
    assert len(res1) == 0
    res2 = await store.search_structural(name_pattern="func2")
    assert len(res2) == 0
    res3 = await store.search_structural(name_pattern="Class3")
    assert len(res3) == 1
    assert res3[0]["id"] == "3"
