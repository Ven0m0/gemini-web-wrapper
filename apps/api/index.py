"""Vercel entrypoint: the service root has no src/ layout, so re-export the installed app."""

from affine.api.server import app

__all__ = ["app"]
