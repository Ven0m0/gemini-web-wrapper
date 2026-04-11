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
    assert settings.provider_default_model() == "gpt-5.4"


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
