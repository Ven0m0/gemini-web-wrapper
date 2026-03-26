"""Deprecated compatibility wrapper.

Canonical module: affine.api.openai_schemas
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.openai_schemas import *  # noqa: F401,F403
