"""Deprecated compatibility wrapper.

Canonical module: affine.api.state
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.state import *  # noqa: F401,F403
