"""Deprecated compatibility wrapper.

Canonical module: affine.api.lifespan
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.lifespan import *  # noqa: F401,F403
