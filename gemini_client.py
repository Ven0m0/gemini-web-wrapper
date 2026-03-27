"""Deprecated compatibility wrapper.

Canonical module: affine.api.gemini_client
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.gemini_client import *  # noqa: F401,F403
