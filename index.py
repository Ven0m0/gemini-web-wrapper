"""Vercel entrypoint for the api service, whose root is the repo root.

Rooting the service at the workspace root makes the root project the one Vercel's runtime
`uv sync` skips; rooted at apps/api it tried to build affine-api from a directory that is
not in the runtime bundle (FUNCTION_INVOCATION_FAILED).
"""

from affine.api.server import app

__all__ = ["app"]
