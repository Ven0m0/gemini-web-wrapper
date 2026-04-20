from affine.llm_core.providers.gemini import GeminiProvider


def test_extract_text_happy_path():
    data = {
        "candidates": [{"content": {"parts": [{"text": "hello "}, {"text": "world"}]}}]
    }
    assert GeminiProvider._extract_text(data) == "hello world"


def test_extract_text_missing_candidates():
    data = {}
    assert GeminiProvider._extract_text(data) == ""


def test_extract_text_empty_candidates():
    data = {"candidates": []}
    assert GeminiProvider._extract_text(data) == ""


def test_extract_text_missing_content():
    data = {"candidates": [{}]}
    assert GeminiProvider._extract_text(data) == ""


def test_extract_text_missing_parts():
    data = {"candidates": [{"content": {}}]}
    assert GeminiProvider._extract_text(data) == ""


def test_extract_text_empty_parts():
    data = {"candidates": [{"content": {"parts": []}}]}
    assert GeminiProvider._extract_text(data) == ""


def test_extract_text_missing_text_in_parts():
    data = {"candidates": [{"content": {"parts": [{}, {"text": "hello"}]}}]}
    assert GeminiProvider._extract_text(data) == "hello"


def test_extract_text_none_text_in_parts():
    data = {"candidates": [{"content": {"parts": [{"text": None}, {"text": "hello"}]}}]}
    assert GeminiProvider._extract_text(data) == "hello"
