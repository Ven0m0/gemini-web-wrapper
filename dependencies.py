"""Deprecated compatibility wrapper.

Canonical module: affine.api.dependencies
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.dependencies import *  # noqa: F401,F403
