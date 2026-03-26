"""Application configuration and settings.

This module re-exports settings from the shared config package.
"""

from affine.config import Settings, get_settings

__all__ = ["Settings", "get_settings"]
