import pytest
from pydantic import ValidationError

from affine.shared.models import MessageRole
from affine.shared.openai_schemas import ChatCompletionRequest, ChatMessage


def test_chat_completion_request_valid_no_provider_override():
    request = ChatCompletionRequest(
        model="test-model",
        messages=[ChatMessage(role=MessageRole.USER, content="Hello")],
    )
    assert request.x_provider is None
    assert request.x_provider_base_url is None


def test_chat_completion_request_valid_provider_only():
    request = ChatCompletionRequest(
        model="test-model",
        messages=[ChatMessage(role=MessageRole.USER, content="Hello")],
        x_provider="custom-provider",
    )
    assert request.x_provider == "custom-provider"
    assert request.x_provider_base_url is None


def test_chat_completion_request_valid_provider_and_base_url():
    request = ChatCompletionRequest(
        model="test-model",
        messages=[ChatMessage(role=MessageRole.USER, content="Hello")],
        x_provider="custom-provider",
        x_provider_base_url="https://api.custom-provider.com/v1",
    )
    assert request.x_provider == "custom-provider"
    assert request.x_provider_base_url == "https://api.custom-provider.com/v1"


def test_chat_completion_request_invalid_base_url_without_provider():
    with pytest.raises(ValidationError) as exc_info:
        ChatCompletionRequest(
            model="test-model",
            messages=[ChatMessage(role=MessageRole.USER, content="Hello")],
            x_provider_base_url="https://api.custom-provider.com/v1",
        )

    assert "x_provider_base_url requires x_provider" in str(exc_info.value)
