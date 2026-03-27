"""Deprecated compatibility wrapper.

Canonical module: affine.api.endpoints.gemini
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.endpoints.gemini import *  # noqa: F401,F403
