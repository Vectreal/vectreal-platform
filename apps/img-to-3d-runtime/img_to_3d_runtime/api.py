"""
The web entry point: wires `web.create_web_app` to the Modal Dicts and the GPU
class.

`requires_proxy_auth=True` makes Modal reject any request without a valid
proxy token (`Modal-Key` and `Modal-Secret` headers) before it reaches a
container. Tokens are created per workspace with
`modal workspace proxy-tokens create`, and only the platform holds one.
"""

from __future__ import annotations

import os
from typing import Any, Optional

import modal

from .config import DEFAULT_MAX_IMAGE_BYTES, DEFAULT_POLL_MS
from .inference import ImageTo3dInference
from .infra import app, artifact_store, job_store, runtime_secret, web_image


@app.function(image=web_image, secrets=[runtime_secret])
@modal.asgi_app(requires_proxy_auth=True)
def api() -> Any:
    from .web import create_web_app

    async def read_job(job_id: str) -> Optional[dict[str, Any]]:
        return await job_store.get.aio(job_id)

    async def create_job(job_id: str, state: dict[str, Any]) -> bool:
        return await job_store.put.aio(job_id, state, skip_if_exists=True)

    async def delete_job(job_id: str) -> None:
        await job_store.pop.aio(job_id, None)

    async def read_artifact(job_id: str) -> Optional[bytes]:
        return await artifact_store.get.aio(job_id)

    async def spawn_generation(image_bytes: bytes, job_id: str, params: dict[str, Any]) -> None:
        await ImageTo3dInference().generate.spawn.aio(image_bytes, job_id, params)

    return create_web_app(
        read_job=read_job,
        create_job=create_job,
        delete_job=delete_job,
        read_artifact=read_artifact,
        spawn_generation=spawn_generation,
        max_image_bytes=int(os.environ.get("IMG_TO_3D_MAX_IMAGE_BYTES", DEFAULT_MAX_IMAGE_BYTES)),
        poll_ms=int(os.environ.get("IMG_TO_3D_STATUS_POLL_MS", DEFAULT_POLL_MS)),
    )
