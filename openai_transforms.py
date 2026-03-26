"""Deprecated compatibility wrapper.

Canonical module: affine.api.openai_transforms
"""

from _legacy_api import bootstrap

bootstrap()

from affine.api.openai_transforms import *  # noqa: F401,F403
