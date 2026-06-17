"""
GPU inference layer — ImageTo3dInference class and generation helpers.

Runs on Modal A100 instances. Imported by modal_app.py; do not run directly.

TRELLIS.2-4B pipeline stages (in order):
  1. Sparse Structure Sampler  — generates a coarse occupancy field from the image
  2. Shape Latent Sampler      — refines the geometry in latent space
  3. Texture Latent Sampler    — adds material/colour information to the latent

All three stages run inside pipeline.run(image) and collectively take the bulk
of inference time (~3 s at 512³ on H100, ~17 s at 1024³, ~60 s at 1536³).

After pipeline.run():
  mesh.simplify(N)  — hard-clamps the voxel face count to N so nvdiffrast does
                      not exceed its CUDA kernel limits. 16 777 216 = 2²⁴ is the
                      documented maximum. This is NOT a quality-loss operation
                      under normal model outputs; it is a safety guard.

  o_voxel.postprocess.to_glb(...)
                    — converts the structured latent mesh to a GLB file:
                        • remesh=True: topological cleanup via isotropic remeshing
                        • decimation_target=1_000_000: Quadric decimation → 1M tris
                        • texture_size=4096: bakes diffuse + normal + roughness PBR
                          maps at 4096² resolution using nvdiffrec. This step is
                          where actual material rendering occurs.
"""

from __future__ import annotations

import io
from typing import TYPE_CHECKING, Optional

import modal

# modal_app.py is the local entry point and is NOT mounted in GPU containers.
# The try block uses its authoritative definitions when running locally;
# the except block provides self-contained fallbacks for the container runtime.
try:
    from modal_app import (
        HF_CACHE_DIR,
        MODEL_ID,
        app,
        artifact_store,
        gpu_image,
        job_store,
        model_volume,
        runtime_secret,
    )
except ModuleNotFoundError:
    import os as _os
    _HERE = _os.path.dirname(_os.path.abspath(__file__))
    _APP_NAME = "vectreal-img-to-3d-runtime"
    MODEL_ID = "microsoft/TRELLIS.2-4B"
    HF_CACHE_DIR = "/vol/huggingface"
    app = modal.App(_APP_NAME)
    model_volume = modal.Volume.from_name("img-to-3d-model-cache", create_if_missing=True)
    job_store = modal.Dict.from_name("img-to-3d-jobs")
    artifact_store = modal.Dict.from_name("img-to-3d-artifacts")
    runtime_secret = modal.Secret.from_name("img-to-3d-runtime-secret")
    # In container context the image is already provisioned; this spec is
    # used only to satisfy the @app.cls decorator — no build is triggered.
    gpu_image = modal.Image.from_registry(
        "nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04", add_python="3.10"
    )

if TYPE_CHECKING:
    pass  # avoid heavy GPU imports at type-check time

# ---------------------------------------------------------------------------
# Job state type (matches the dict shape written to Modal Dict)
# ---------------------------------------------------------------------------

JobStatus = str  # "queued" | "starting" | "processing" | "succeeded" | "failed"


def _set_job(
    job_id: str,
    status: JobStatus,
    progress: Optional[int],
    message: Optional[str],
) -> None:
    job_store[job_id] = {"status": status, "progress": progress, "message": message}


# ---------------------------------------------------------------------------
# Inference helper
# ---------------------------------------------------------------------------

def _generate_real(pipeline: object, image_bytes: bytes, job_id: str) -> None:
    """
    Run the TRELLIS.2-4B pipeline on a single image and store the GLB artifact.

    Progress checkpoints are written to job_store so the web layer can relay
    them to the client during polling.
    """
    from PIL import Image

    # --- Stage 0: decode image ---
    _set_job(job_id, "processing", 5, "Decoding image")
    image = Image.open(io.BytesIO(image_bytes)).convert("RGBA")

    # --- Stages 1-3: Sparse Structure → Shape Latent → Texture Latent ---
    # pipeline.run() executes all three internal samplers sequentially.
    # This is the longest step; the progress jump from 5% to 70% reflects that.
    _set_job(job_id, "processing", 10, "Generating 3D structure")
    mesh = pipeline.run(image)[0]  # type: ignore[attr-defined]

    # --- Post-processing: face-count guard ---
    # mesh.simplify() clamps the occupancy field to 16 777 216 faces, which is
    # the hard limit of the nvdiffrast CUDA kernel used in the next step.
    # Under normal inference outputs this is a no-op; it exists to prevent
    # OOM / assertion failures on unusually dense generations.
    _set_job(job_id, "processing", 70, "Preparing mesh for texture baking")
    mesh.simplify(16_777_216)

    # --- Post-processing: PBR texture baking and GLB export ---
    # to_glb runs nvdiffrec to bake diffuse, normal, and roughness maps onto
    # the decimated mesh, then serialises everything to the GLB binary format.
    #   remesh=True           — isotropic remesh before baking for clean UVs
    #   decimation_target=1M  — Quadric error decimation → manageable triangle count
    #   texture_size=4096     — 4096² PBR atlas resolution
    _set_job(job_id, "processing", 75, "Baking PBR textures")
    import o_voxel  # type: ignore[import-untyped]

    glb = o_voxel.postprocess.to_glb(
        vertices=mesh.vertices,
        faces=mesh.faces,
        attr_volume=mesh.attrs,
        coords=mesh.coords,
        attr_layout=mesh.layout,
        voxel_size=mesh.voxel_size,
        aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
        decimation_target=1_000_000,
        texture_size=4096,
        remesh=True,
    )

    _set_job(job_id, "processing", 95, "Exporting GLB")
    buf = io.BytesIO()
    glb.export(buf, file_type="glb")

    artifact_store[job_id] = buf.getvalue()
    _set_job(job_id, "succeeded", 100, None)


# ---------------------------------------------------------------------------
# GPU inference class
# ---------------------------------------------------------------------------


@app.cls(
    image=gpu_image,
    # A100 is the minimum GPU for TRELLIS.2-4B (requires ≥24 GB VRAM).
    # Modal may silently upgrade to an A100-80GB or better at no extra cost.
    gpu="A100",
    timeout=600,
    volumes={HF_CACHE_DIR: model_volume},
    secrets=[runtime_secret],
    # One active job per GPU instance; Modal scales horizontally when demand
    # exceeds this. Keeping max_containers at 1 prevents VRAM contention.
    max_containers=1,
)
class ImageTo3dInference:
    @modal.enter()
    def load(self) -> None:
        """Runs once when a new container is provisioned. Loads the model into GPU memory."""
        from trellis2.pipelines import Trellis2ImageTo3DPipeline  # type: ignore[import-untyped]

        self._pipeline = Trellis2ImageTo3DPipeline.from_pretrained(MODEL_ID)
        self._pipeline.cuda()
        # Flush any newly downloaded weights to the persistent volume so
        # subsequent container starts skip the HuggingFace download.
        model_volume.commit()

    @modal.method()
    def generate(self, image_bytes: bytes, job_id: str) -> None:
        """
        Run inference and update job_store / artifact_store.

        Called via .spawn() from the web layer — the POST /generations endpoint
        returns immediately while this method executes on the A100.
        """
        try:
            _generate_real(self._pipeline, image_bytes, job_id)
        except Exception as exc:
            _set_job(job_id, "failed", None, str(exc))
            raise  # Surface the full traceback in Modal logs
