from affine.llm_core.providers.openai_compatible import OpenAICompatibleProvider

def test_extract_message_text_string():
    data = {
        "choices": [
            {"message": {"content": "hello world"}}
        ]
    }
    assert OpenAICompatibleProvider._extract_message_text(data) == "hello world"

def test_extract_message_text_list():
    data = {
        "choices": [
            {"message": {"content": [{"text": "hello "}, {"text": "world"}]}}
        ]
    }
    assert OpenAICompatibleProvider._extract_message_text(data) == "hello world"

def test_extract_message_text_empty_choices():
    data = {"choices": []}
    assert OpenAICompatibleProvider._extract_message_text(data) == ""

def test_extract_message_text_missing_choices():
    data = {}
    assert OpenAICompatibleProvider._extract_message_text(data) == ""

def test_extract_message_text_missing_message():
    data = {"choices": [{}]}
    assert OpenAICompatibleProvider._extract_message_text(data) == ""

def test_extract_message_text_missing_content():
    data = {"choices": [{"message": {}}]}
    assert OpenAICompatibleProvider._extract_message_text(data) == ""

def test_extract_message_text_unexpected_content_type():
    data = {"choices": [{"message": {"content": 123}}]}
    assert OpenAICompatibleProvider._extract_message_text(data) == ""

def test_extract_delta_text_string():
    data = {
        "choices": [
            {"delta": {"content": "hello delta"}}
        ]
    }
    assert OpenAICompatibleProvider._extract_delta_text(data) == "hello delta"

def test_extract_delta_text_list():
    data = {
        "choices": [
            {"delta": {"content": [{"text": "hello "}, {"text": "delta"}]}}
        ]
    }
    assert OpenAICompatibleProvider._extract_delta_text(data) == "hello delta"

def test_extract_delta_text_empty_choices():
    data = {"choices": []}
    assert OpenAICompatibleProvider._extract_delta_text(data) == ""

def test_extract_delta_text_missing_choices():
    data = {}
    assert OpenAICompatibleProvider._extract_delta_text(data) == ""

def test_extract_delta_text_missing_delta():
    data = {"choices": [{}]}
    assert OpenAICompatibleProvider._extract_delta_text(data) == ""

def test_extract_delta_text_missing_content():
    data = {"choices": [{"delta": {}}]}
    assert OpenAICompatibleProvider._extract_delta_text(data) == ""

def test_extract_delta_text_unexpected_content_type():
    data = {"choices": [{"delta": {"content": None}}]}
    assert OpenAICompatibleProvider._extract_delta_text(data) == ""
