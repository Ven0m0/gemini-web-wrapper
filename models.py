"""Deprecated compatibility wrapper.

Canonical module: affine.api.models
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.models import *  # noqa: F401,F403
