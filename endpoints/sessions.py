"""Deprecated compatibility wrapper.

Canonical module: affine.api.endpoints.sessions
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.endpoints.sessions import *  # noqa: F401,F403
