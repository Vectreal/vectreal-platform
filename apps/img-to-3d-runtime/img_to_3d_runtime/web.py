"""
The runtime's HTTP API, as a plain FastAPI factory.

Nothing here touches Modal. `api.py` passes in the Modal Dict accessors and the
GPU spawner; tests pass in fakes. Authentication is not handled here at all:
the endpoint is deployed with `requires_proxy_auth=True`, so Modal rejects a
request without valid `Modal-Key` / `Modal-Secret` headers before it reaches
this code.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from typing import Any, Literal, Optional

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, ValidationError

from .config import ALLOWED_IMAGE_TYPES
from .params import GenerationParams

JobStatus = Literal["queued", "processing", "succeeded", "failed"]


class JobState(BaseModel):
    """The shape stored in the job Dict. `inference.py` writes the same keys."""

    status: JobStatus
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    message: Optional[str] = None


ReadJob = Callable[[str], Awaitable[Optional[dict[str, Any]]]]
# Writes only if the id is new, atomically; returns whether it wrote.
CreateJob = Callable[[str, dict[str, Any]], Awaitable[bool]]
DeleteJob = Callable[[str], Awaitable[None]]
ReadArtifact = Callable[[str], Awaitable[Optional[bytes]]]
SpawnGeneration = Callable[[bytes, str, dict[str, Any]], Awaitable[None]]


def _ok(data: dict[str, Any], status: int = 200) -> JSONResponse:
    return JSONResponse({"success": True, "data": data}, status_code=status)


def _err(message: str, status: int) -> JSONResponse:
    return JSONResponse({"success": False, "error": message}, status_code=status)


def create_web_app(
    *,
    read_job: ReadJob,
    create_job: CreateJob,
    delete_job: DeleteJob,
    read_artifact: ReadArtifact,
    spawn_generation: SpawnGeneration,
    max_image_bytes: int,
    poll_ms: int,
) -> FastAPI:
    web = FastAPI(title="Vectreal Image-to-3D Runtime", version="2.0.0")

    @web.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @web.post("/generations")
    async def submit(
        job_id: str = Form(alias="jobId"),
        seed: int = Form(),
        resolution: int = Form(),
        texture_size: int = Form(alias="textureSize"),
        decimation_target: int = Form(alias="decimationTarget"),
        image: UploadFile = File(),
    ) -> JSONResponse:
        try:
            # The platform owns the id so one id names the job on both sides.
            job_id = str(uuid.UUID(job_id))
        except ValueError:
            return _err("jobId must be a UUID", 422)

        try:
            params = GenerationParams(
                seed=seed,
                resolution=resolution,
                texture_size=texture_size,
                decimation_target=decimation_target,
            )
        except ValidationError as error:
            fields = ", ".join(".".join(map(str, e["loc"])) for e in error.errors())
            return _err(f"Invalid generation parameters: {fields}", 422)

        content_type = (image.content_type or "").split(";")[0].strip()
        if content_type not in ALLOWED_IMAGE_TYPES:
            return _err("Only PNG, JPEG and WebP images are accepted", 415)

        image_bytes = await image.read()
        if not image_bytes:
            return _err("The image is empty", 422)
        if len(image_bytes) > max_image_bytes:
            return _err(f"The image exceeds {max_image_bytes // (1024 * 1024)} MB", 413)

        # A resubmitted id would overwrite a job that may already be running
        # and has already cost GPU time. Claimed atomically, so two concurrent
        # submits of one id (a retried request) cannot both spawn.
        if not await create_job(job_id, JobState(status="queued").model_dump()):
            return _err("A job with this id already exists", 409)

        try:
            await spawn_generation(image_bytes, job_id, params.model_dump(by_alias=True))
        except Exception as error:  # noqa: BLE001 - any spawn failure releases the id
            # Released so the caller can retry this job under the same id.
            # Usually nothing ran. If the spawn reached Modal and only the reply
            # was lost, a retry runs the job twice; telling those apart needs
            # the FunctionCall id, which the job-lifecycle change records.
            await delete_job(job_id)
            return _err(f"Could not start generation: {error}", 502)

        return _ok({"jobId": job_id, "status": "queued", "pollAfterMs": poll_ms}, 202)

    @web.get("/generations/{job_id}")
    async def status(job_id: str) -> JSONResponse:
        raw = await read_job(job_id)
        if raw is None:
            return _err("Job not found", 404)

        try:
            state = JobState.model_validate(raw)
        except ValidationError:
            return _err("Job state is unreadable", 500)

        terminal = state.status in ("succeeded", "failed")
        return _ok(
            {
                "jobId": job_id,
                "status": state.status,
                "progress": state.progress,
                "message": state.message,
                "artifactReady": state.status == "succeeded",
                "pollAfterMs": 0 if terminal else poll_ms,
            }
        )

    @web.get("/generations/{job_id}/artifact")
    async def artifact(job_id: str) -> Response:
        glb = await read_artifact(job_id)
        if not glb:
            return _err("Artifact not found or generation not complete", 404)

        return Response(
            content=glb,
            media_type="model/gltf-binary",
            headers={"Cache-Control": "no-store"},
        )

    return web
