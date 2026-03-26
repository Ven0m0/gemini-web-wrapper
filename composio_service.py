"""Deprecated compatibility wrapper.

Canonical module: affine.api.composio_service
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.composio_service import *  # noqa: F401,F403
