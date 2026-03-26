"""Deprecated compatibility wrapper.

Canonical module: affine.api.endpoints.github
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.endpoints.github import *  # noqa: F401,F403
