"""Deprecated compatibility wrapper.

Canonical module: affine.api.config
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.config import *  # noqa: F401,F403
