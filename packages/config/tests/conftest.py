import pytest

from affine.config.settings import Settings


@pytest.fixture(autouse=True)
def _ignore_env_files(monkeypatch: pytest.MonkeyPatch) -> None:
    # A developer's repo-root .env must not leak real keys or CORS into tests.
    monkeypatch.setitem(Settings.model_config, "env_file", None)
