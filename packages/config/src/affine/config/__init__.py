"""Shared configuration package for Affine AI Coding Workstation.

This package provides typed environment configuration loaded from environment
variables or .env files. Both the web and api apps use this shared package.
"""

from affine.config.settings import Settings, get_settings

__all__ = ["Settings", "get_settings"]
