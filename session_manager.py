"""Deprecated compatibility wrapper.

Canonical module: affine.api.session_manager
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.session_manager import *  # noqa: F401,F403
