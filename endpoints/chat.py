"""Deprecated compatibility wrapper.

Canonical module: affine.api.endpoints.chat
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.endpoints.chat import *  # noqa: F401,F403
