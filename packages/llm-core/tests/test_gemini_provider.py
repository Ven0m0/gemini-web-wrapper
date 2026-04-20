import pytest
from affine.llm_core.providers.gemini import GeminiProvider

def test_gemini_convert_messages_prompt_only() -> None:
    provider = GeminiProvider(api_key="test")
    prompt = "Hello"
    result = provider._convert_messages(prompt)

    assert result == [
        {"role": "user", "parts": [{"text": "Hello"}]}
    ]

def test_gemini_convert_messages_empty_history() -> None:
    provider = GeminiProvider(api_key="test")
    prompt = "Hello"
    result = provider._convert_messages(prompt, history=[])

    assert result == [
        {"role": "user", "parts": [{"text": "Hello"}]}
    ]

def test_gemini_convert_messages_with_history() -> None:
    provider = GeminiProvider(api_key="test")
    prompt = "How are you?"
    history = [
        {"role": "user", "content": "Hi"},
        {"role": "assistant", "content": "Hello! I am an AI."},
    ]
    result = provider._convert_messages(prompt, history=history)

    assert result == [
        {"role": "user", "parts": [{"text": "Hi"}]},
        {"role": "model", "parts": [{"text": "Hello! I am an AI."}]},
        {"role": "user", "parts": [{"text": "How are you?"}]},
    ]

def test_gemini_convert_messages_role_mapping() -> None:
    provider = GeminiProvider(api_key="test")
    prompt = "test"
    # Testing that anything not 'user' is mapped to 'model'
    # Current implementation: role = "user" if msg["role"] == "user" else "model"
    history = [
        {"role": "system", "content": "system instruction"},
        {"role": "assistant", "content": "assistant response"},
        {"role": "tool", "content": "tool output"},
    ]
    result = provider._convert_messages(prompt, history=history)

    assert result[0] == {"role": "model", "parts": [{"text": "system instruction"}]}
    assert result[1] == {"role": "model", "parts": [{"text": "assistant response"}]}
    assert result[2] == {"role": "model", "parts": [{"text": "tool output"}]}
    assert result[3] == {"role": "user", "parts": [{"text": "test"}]}
