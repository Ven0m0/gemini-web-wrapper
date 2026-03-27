"""Deprecated compatibility entrypoint for the packaged API app.

Canonical module: affine.api.server
"""

from __future__ import annotations

import os

from _legacy_api import bootstrap

bootstrap()

from affine.api.server import app
from affine.api.state import state

__all__ = ["app", "state"]

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "affine.api.server:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 9000)),
        loop="uvloop",
        reload=False,
    )
