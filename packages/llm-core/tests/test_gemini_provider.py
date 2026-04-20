from affine.llm_core.providers.gemini import GeminiProvider

def test_extract_text_happy_path():
    data = {"candidates": [{"content": {"parts": [{"text": "hello "}, {"text": "world"}]}}]}
    assert GeminiProvider._extract_text(data) == "hello world"

def test_extract_text_missing_candidates():
    data = {}
    assert GeminiProvider._extract_text(data) == ""

def test_extract_text_empty_candidates():
    data = {"candidates": []}
    # [{}][0] on empty list will fail with IndexError. Let's see what the code does:
    # parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    # Wait, if "candidates" is [], data.get("candidates", [{}]) returns []
    # then [0] on [] raises IndexError!
