from affine.api.server import _extract_non_empty_text
import pytest

@pytest.mark.parametrize("value, expected", [
    ("hello", "hello"),
    ("  world  ", "world"),
    ("", None),
    ("   ", None),
    (None, None),
    (123, None),
    ([], None),
    ({}, None),
])
def test_extract_non_empty_text(value, expected):
    assert _extract_non_empty_text(value) == expected
