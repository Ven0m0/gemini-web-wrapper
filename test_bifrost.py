"""Tests for Bifrost provider integration."""

from llm_core.factory import ProviderFactory
from llm_core.providers.bifrost import BifrostProvider


def test_bifrost_provider_creation():
    """Test that BifrostProvider can be created through factory."""
    provider = ProviderFactory.create(
        provider="bifrost",
        api_key="test-key",
        model_name="gpt-4o-mini",
    )
    assert isinstance(provider, BifrostProvider)
    assert provider.model == "gpt-4o-mini"


def test_bifrost_provider_direct_creation():
    """Test direct instantiation of BifrostProvider."""
    provider = BifrostProvider(
        base_url="http://localhost:8080/v1",
        api_key="test-key",
        model="gpt-4o",
    )
    assert provider.model == "gpt-4o"
    assert "/v1" in str(provider.client.base_url)


def test_bifrost_provider_default_values():
    """Test BifrostProvider with default values."""
    provider = BifrostProvider(api_key="test-key")
    assert provider.model == "gpt-4o-mini"


def test_bifrost_message_building():
    """Test message building for OpenAI format."""
    provider = BifrostProvider(api_key="test-key")

    # Test with system message and history
    messages = provider._build_messages(
        prompt="Hello",
        system="You are a helpful assistant",
        history=[
            {"role": "user", "content": "Hi"},
            {"role": "model", "content": "Hello!"},
        ],
    )

    assert len(messages) == 4
    assert messages[0]["role"] == "system"
    assert messages[0]["content"] == "You are a helpful assistant"
    assert messages[1]["role"] == "user"
    assert messages[1]["content"] == "Hi"
    assert messages[2]["role"] == "assistant"  # "model" normalized to "assistant"
    assert messages[2]["content"] == "Hello!"
    assert messages[3]["role"] == "user"
    assert messages[3]["content"] == "Hello"


def test_bifrost_message_building_no_system():
    """Test message building without system message."""
    provider = BifrostProvider(api_key="test-key")

    messages = provider._build_messages(
        prompt="Test prompt", system=None, history=None
    )

    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "Test prompt"
