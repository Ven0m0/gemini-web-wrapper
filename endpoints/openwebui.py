"""Deprecated compatibility wrapper.

Canonical module: affine.api.endpoints.openwebui
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.endpoints.openwebui import *  # noqa: F401,F403
