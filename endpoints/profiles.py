"""Deprecated compatibility wrapper.

Canonical module: affine.api.endpoints.profiles
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.endpoints.profiles import *  # noqa: F401,F403
