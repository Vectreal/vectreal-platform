"""
Deploy entry point: `modal deploy -m img_to_3d_runtime.app`.

Importing the two modules registers their functions on the shared app.
`checks.py` is left out on purpose, so the GPU self-check never deploys.
"""

from . import api, inference  # noqa: F401
from .infra import app

__all__ = ["app"]
