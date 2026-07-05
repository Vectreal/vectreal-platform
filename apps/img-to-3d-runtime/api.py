"""
CPU web layer — FastAPI application served by Modal.

Handles authentication, request validation, and job state reads/writes.
GPU inference is dispatched asynchronously to ImageTo3dInference via .spawn().

All request/response shapes are defined as Pydantic models so FastAPI
validates them at the boundary and returns 422 Unprocessable Entity on
malformed input rather than propagating bad data into the job pipeline.

Modal only mounts the file that defines each function in its container.
The try/except below uses modal_app.py's resources when running locally
(where modal_app.py is the entry point), and falls back to self-contained
definitions when Modal runs this file directly in the web container.
"""

import os
import uuid
from typing import Annotated, Generic, Literal, Optional, TypeVar

import modal
from pydantic import BaseModel, Field

# _HERE is defined unconditionally so the mounts= spec below can reference it
# in both the local (try) and container (except) code paths.
_HERE = os.path.dirname(os.path.abspath(__file__))

try:
    from modal_app import (
        APP_NAME,
        ALLOWED_MIME,
        DEFAULT_POLL_MS,
        app,
        artifact_store,
        job_store,
        runtime_secret,
        web_image,
    )
except ModuleNotFoundError:
    APP_NAME = "vectreal-img-to-3d-runtime"
    ALLOWED_MIME = frozenset({"image/png", "image/jpeg", "image/webp"})
    DEFAULT_POLL_MS = 4_000
    app = modal.App(APP_NAME)
    job_store = modal.Dict.from_name("img-to-3d-jobs", create_if_missing=True)
    artifact_store = modal.Dict.from_name("img-to-3d-artifacts", create_if_missing=True)
    runtime_secret = modal.Secret.from_name("img-to-3d-runtime-secret")
    web_image = (
        modal.Image.debian_slim(python_version="3.10")
        .add_local_file(os.path.join(_HERE, "pyproject.toml"), "/app/pyproject.toml", copy=True)
        .run_commands(
            "pip install uv",
            "cd /app && uv pip install --system '.[web]'",
        )
    )


# ---------------------------------------------------------------------------
# Response types
# ---------------------------------------------------------------------------

T = TypeVar("T")

JobStatus = Literal["queued", "starting", "processing", "succeeded", "failed"]


class JobEntry(BaseModel):
    """Minimal job descriptor returned on submission."""

    jobId: str
    status: JobStatus
    pollAfterMs: int = Field(ge=0)


class SubmitData(BaseModel):
    """Payload returned by POST /generations. One entry per uploaded image."""

    jobs: list[JobEntry] = Field(min_length=1)


class StatusData(BaseModel):
    """Full job status, returned by GET /generations/{jobId}."""

    jobId: str
    status: JobStatus
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    message: Optional[str] = None
    artifactReady: bool
    retryable: bool
    pollAfterMs: int = Field(ge=0)


class OkResponse(BaseModel, Generic[T]):
    success: Literal[True] = True
    data: T


class ErrResponse(BaseModel):
    success: Literal[False] = False
    error: str


# Internal shape stored in Modal Dict — kept in sync with _set_job() in inference.py
class _JobState(BaseModel):
    status: JobStatus
    progress: Optional[int] = None
    message: Optional[str] = None


# ---------------------------------------------------------------------------
# FastAPI application factory
# ---------------------------------------------------------------------------


@app.function(image=web_image, secrets=[runtime_secret])
@modal.asgi_app()
def api() -> object:  # FastAPI instance; typed as object to avoid import at module scope
    from fastapi import FastAPI, File, Request, Response, UploadFile
    from fastapi.responses import JSONResponse

    web = FastAPI(title="Vectreal Image-to-3D Runtime", version="1.0.0")

    _auth_secret: str = os.environ["IMG_TO_3D_RUNTIME_AUTH_SECRET"]
    _max_bytes: int = int(os.environ.get("IMG_TO_3D_MAX_IMAGE_BYTES", 10 * 1024 * 1024))
    _poll_ms: int = int(os.environ.get("IMG_TO_3D_STATUS_POLL_MS", DEFAULT_POLL_MS))

    # --- Auth ---

    def _authorized(request: Request) -> bool:
        return request.headers.get("x-img-to-3d-runtime-secret") == _auth_secret

    # --- Response helpers ---

    def _ok(data: BaseModel) -> JSONResponse:
        return JSONResponse({"success": True, "data": data.model_dump()})

    def _err(msg: str, status: int = 400) -> JSONResponse:
        return JSONResponse({"success": False, "error": msg}, status_code=status)

    # --- Routes ---

    @web.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    @web.post("/generations", summary="Submit one or more images for 3D generation.")
    async def submit(
        request: Request,
        images: list[UploadFile] = File(description="PNG, JPEG, or WebP images. Each image generates a separate job."),
    ) -> JSONResponse:
        if not _authorized(request):
            return _err("Unauthorized", 401)

        if not images:
            return _err("At least one image is required")

        jobs: list[JobEntry] = []

        for upload in images:
            content_type = (upload.content_type or "").split(";")[0].strip()
            if content_type not in ALLOWED_MIME:
                return _err(
                    f"Unsupported image type '{content_type}' for file '{upload.filename}'. "
                    "Only PNG, JPEG, and WebP are accepted.",
                    415,
                )

            image_bytes = await upload.read()

            if not image_bytes:
                return _err(f"Image '{upload.filename}' is empty")

            if len(image_bytes) > _max_bytes:
                limit_mb = _max_bytes // (1024 * 1024)
                return _err(
                    f"Image '{upload.filename}' exceeds the {limit_mb} MB size limit",
                    413,
                )

            job_id = str(uuid.uuid4())
            await job_store.put.aio(job_id, _JobState(status="queued").model_dump())

            # Fire-and-forget: the GPU function runs asynchronously on Modal.
            # The POST returns immediately; clients poll /generations/{jobId}.
            # from_name() requires a deployed app (modal deploy). For local
            # testing without GPU, enable IMG_TO_3D_MOCK_MODE=true instead.
            try:
                await modal.Cls.from_name(APP_NAME, "ImageTo3dInference")().generate.spawn.aio(
                    image_bytes, job_id
                )
            except Exception as spawn_err:
                await job_store.put.aio(
                    job_id,
                    _JobState(
                        status="failed",
                        message=(
                            f"GPU inference unavailable: {spawn_err}. "
                            "Deploy the app with 'modal deploy' or set IMG_TO_3D_MOCK_MODE=true."
                        ),
                    ).model_dump(),
                )
                jobs.append(JobEntry(jobId=job_id, status="failed", pollAfterMs=0))
                continue

            jobs.append(JobEntry(jobId=job_id, status="queued", pollAfterMs=_poll_ms))

        return _ok(SubmitData(jobs=jobs))

    @web.get(
        "/generations/{job_id}",
        response_model=OkResponse[StatusData],
        summary="Poll the status of a generation job.",
    )
    async def status(job_id: str, request: Request) -> JSONResponse:
        if not _authorized(request):
            return _err("Unauthorized", 401)

        raw = await job_store.get.aio(job_id)
        if raw is None:
            return _err("Job not found", 404)

        # Validate the stored shape — catches stale data from schema changes
        try:
            state = _JobState.model_validate(raw)
        except Exception:
            return _err("Job state is corrupted", 500)

        artifact_ready = state.status == "succeeded"
        return _ok(
            StatusData(
                jobId=job_id,
                status=state.status,
                progress=state.progress,
                message=state.message,
                artifactReady=artifact_ready,
                retryable=state.status == "failed",
                pollAfterMs=0 if (artifact_ready or state.status == "failed") else _poll_ms,
            )
        )

    @web.get(
        "/generations/{job_id}/artifact",
        summary="Download the generated GLB model.",
    )
    async def artifact(job_id: str, request: Request) -> Response:
        if not _authorized(request):
            return _err("Unauthorized", 401)

        glb_bytes: bytes | None = await artifact_store.get.aio(job_id)
        if glb_bytes is None:
            return _err("Artifact not found or generation not complete", 404)

        if not isinstance(glb_bytes, bytes) or not glb_bytes:
            return _err("Artifact is missing or corrupt", 500)

        return Response(
            content=glb_bytes,
            media_type="model/gltf-binary",
            headers={
                "Content-Disposition": f'attachment; filename="{job_id}.glb"',
                "Cache-Control": "no-store",
            },
        )

    return web
