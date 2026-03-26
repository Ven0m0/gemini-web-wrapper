"""Deprecated compatibility wrapper.

Canonical module: affine.api.endpoints.openai
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.endpoints.openai import *  # noqa: F401,F403
