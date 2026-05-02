from __future__ import annotations

import pytest
from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials

from affine.api.server import _extract_non_empty_text, verify_api_key
from affine.config.settings import Settings


@pytest.mark.parametrize(
    "value, expected",
    [
        ("hello", "hello"),
        ("  world  ", "world"),
        ("", None),
        ("   ", None),
        (None, None),
        (123, None),
        ([], None),
        ({}, None),
    ],
)
def test_extract_non_empty_text(value, expected):
    assert _extract_non_empty_text(value) == expected


def test_verify_api_key_success():
    """Test verify_api_key succeeds with valid credentials and configured settings."""
    settings = Settings(api_key="valid-secret-key")
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer", credentials="valid-secret-key"
    )

    result = verify_api_key(credentials=credentials, settings=settings)

    assert result == credentials


def test_verify_api_key_missing_settings_api_key():
    """Test verify_api_key raises 500 if the server API key is not configured."""
    settings = Settings(api_key=None)
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="some-key")

    with pytest.raises(HTTPException) as exc_info:
        verify_api_key(credentials=credentials, settings=settings)

    assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert exc_info.value.detail == "Server API key is not configured"


def test_verify_api_key_missing_credentials():
    """Test verify_api_key raises 401 if credentials are not provided."""
    settings = Settings(api_key="valid-secret-key")
    credentials = None

    with pytest.raises(HTTPException) as exc_info:
        verify_api_key(credentials=credentials, settings=settings)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert exc_info.value.detail == "Invalid or missing API Key"
    assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}


def test_verify_api_key_invalid_credentials():
    """Test verify_api_key raises 401 if credentials do not match the server API key."""
    settings = Settings(api_key="valid-secret-key")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="wrong-key")

    with pytest.raises(HTTPException) as exc_info:
        verify_api_key(credentials=credentials, settings=settings)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert exc_info.value.detail == "Invalid or missing API Key"
    assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}
