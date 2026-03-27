"""Deprecated compatibility wrapper.

Canonical module: affine.api.endpoints.tools
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.endpoints.tools import *  # noqa: F401,F403
