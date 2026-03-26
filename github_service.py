"""Deprecated compatibility wrapper.

Canonical module: affine.api.github_service
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.github_service import *  # noqa: F401,F403
