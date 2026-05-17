from pathlib import Path

import pytest

from affine.config.settings import Settings, get_settings


def test_settings_parse_cors_origins_and_provider_api_key() -> None:
    settings = Settings(
        cors_allow_origins="https://one.example, https://two.example",
        model_provider="anthropic",
        anthropic_api_key="anthropic-key",
    )

    assert settings.cors_allow_origins == [
        "https://one.example",
        "https://two.example",
    ]
    assert settings.provider_api_key() == "anthropic-key"
    assert settings.frontend_dist_dir == Path("apps/web/dist")
    assert settings.repo_index_db_path == Path(".cache/repo-index.db")


def test_settings_gateway_provider_metadata() -> None:
    settings = Settings(
        model_provider="kilo-gateway",
        kilo_api_key="kilo-key",
    )

    assert settings.provider_api_key() == "kilo-key"
    assert settings.provider_base_url() == "https://api.kilo.ai/api/gateway"
    assert settings.provider_default_model() == "kilo-auto/balanced"


def test_settings_copilot_provider_metadata() -> None:
    settings = Settings(
        model_provider="copilot",
        copilot_api_key="copilot-key",
    )

    assert settings.provider_api_key() == "copilot-key"
    assert settings.provider_base_url() == "https://api.githubcopilot.com"
    assert settings.provider_default_model() == "claude-sonnet-4.6"


def test_settings_opencode_provider_metadata() -> None:
    settings = Settings(
        model_provider="opencode-zen",
        opencode_api_key="opencode-key",
    )

    assert settings.provider_api_key() == "opencode-key"
    assert settings.provider_base_url() == "http://localhost:4096/zen/v1"
    assert settings.provider_default_model() == "opencode/glm-5.1"


def test_get_settings_is_cached() -> None:
    get_settings.cache_clear()

    first = get_settings()
    second = get_settings()

    assert first is second


def test_settings_validate_list_cors_origins() -> None:
    settings = Settings(cors_allow_origins=[" https://one.example ", ""])

    assert settings.cors_allow_origins == ["https://one.example"]

    with pytest.raises(ValueError, match="CORS origins must be strings"):
        Settings(cors_allow_origins=[1])  # type: ignore[list-item]


def test_settings_default_cors_origins() -> None:
    settings = Settings()
    assert settings.cors_allow_origins == []


def test_settings_empty_cors_origins() -> None:
    settings = Settings(cors_allow_origins=["", " "])
    assert settings.cors_allow_origins == []


def test_get_settings_env_and_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    # Clear cache to ensure a fresh start
    get_settings.cache_clear()

    # Set initial environment variables
    monkeypatch.setenv("MODEL_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-1")

    # Load settings and verify it picks up the env vars
    settings = get_settings()
    assert settings.model_provider == "anthropic"
    assert settings.anthropic_api_key == "test-key-1"

    # Change environment variables
    monkeypatch.setenv("MODEL_PROVIDER", "copilot")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-2")
    monkeypatch.setenv("COPILOT_API_KEY", "copilot-key-1")

    # Load settings again, should return the cached instance, unmodified
    cached_settings = get_settings()
    assert cached_settings is settings
    assert cached_settings.model_provider == "anthropic"
    assert cached_settings.anthropic_api_key == "test-key-1"
    assert cached_settings.copilot_api_key is None

    # Clear the cache, now it should pick up the new env vars
    get_settings.cache_clear()
    new_settings = get_settings()

    assert new_settings is not settings
    assert new_settings.model_provider == "copilot"
    assert new_settings.anthropic_api_key == "test-key-2"
    assert new_settings.copilot_api_key == "copilot-key-1"

    # Clean up cache at the end to avoid polluting other tests
    get_settings.cache_clear()


def test_settings_wildcard_cors_origin_rejected() -> None:
    with pytest.raises(
        ValueError, match=r"Wildcard '\*' is not allowed in CORS origins"
    ):
        Settings(cors_allow_origins=["*"])

    with pytest.raises(
        ValueError, match=r"Wildcard '\*' is not allowed in CORS origins"
    ):
        Settings(cors_allow_origins="*")

    with pytest.raises(
        ValueError, match=r"Wildcard '\*' is not allowed in CORS origins"
    ):
        Settings(cors_allow_origins="http://localhost:3000, *")
