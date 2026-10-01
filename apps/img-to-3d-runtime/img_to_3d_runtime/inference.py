"""
The GPU layer: loads TRELLIS.2-4B once per container and turns one image into
one textured GLB per call.

Heavy imports live inside the methods. The web container imports this module
to get a handle on the class it spawns, and it has neither torch nor TRELLIS.2.
"""

from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any, Optional

import modal

from .config import (
    GENERATION_TIMEOUT_S,
    MODEL_DIR,
    MODEL_REPO,
    MODEL_REVISION,
    PIPELINE_CONFIG,
    REMBG_DIR,
    REMBG_REPO,
    REMBG_REVISION,
    VOLUME_PATH,
)
from .infra import app, artifact_store, gpu_image, job_store, model_volume, runtime_secret
from .params import GenerationParams
from .pipeline_config import use_birefnet

# The size every upstream example clamps to before export. Upstream's comment
# calls it nvdiffrast's limit; it is kept as the size the export path is known
# to handle, and is a no-op for ordinary outputs.
MAX_EXPORT_FACES = 16_777_216


def _set_job(job_id: str, status: str, progress: Optional[int], message: Optional[str] = None) -> None:
    # Same keys as `web.JobState`.
    job_store[job_id] = {"status": status, "progress": progress, "message": message}


def _prepare_weights() -> str:
    """
    Snapshot the pinned weights into the Volume and write a pipeline config
    that uses BiRefNet for background removal. Returns the directory to load
    the pipeline from.

    RMBG-2.0 is never downloaded; see `pipeline_config.use_birefnet`.
    """
    from huggingface_hub import snapshot_download

    snapshot_download(MODEL_REPO, revision=MODEL_REVISION, local_dir=MODEL_DIR)
    snapshot_download(REMBG_REPO, revision=REMBG_REVISION, local_dir=REMBG_DIR)

    upstream = json.loads((Path(MODEL_DIR) / "pipeline.json").read_text())
    rewritten = use_birefnet(upstream, REMBG_DIR)
    (Path(MODEL_DIR) / PIPELINE_CONFIG).write_text(json.dumps(rewritten, indent=2))

    return MODEL_DIR


@app.cls(
    image=gpu_image,
    gpu="A100-80GB",
    timeout=GENERATION_TIMEOUT_S,
    volumes={VOLUME_PATH: model_volume},
    secrets=[runtime_secret],
    # One generation per GPU at a time, and never more than one GPU: every
    # job queues behind the last, which bounds both VRAM contention and spend.
    max_containers=1,
)
class ImageTo3dInference:
    @modal.enter()
    def load(self) -> None:
        from trellis2.pipelines import Trellis2ImageTo3DPipeline

        model_dir = _prepare_weights()
        self._pipeline = Trellis2ImageTo3DPipeline.from_pretrained(model_dir, config_file=PIPELINE_CONFIG)
        self._pipeline.cuda()
        # Persist anything downloaded on this cold start (the snapshots, and
        # the decoder and DINOv3 weights fetched into HF_HOME) for the next.
        model_volume.commit()

    @modal.method()
    def generate(self, image_bytes: bytes, job_id: str, params: dict[str, Any]) -> None:
        try:
            self._generate(image_bytes, job_id, GenerationParams.model_validate(params))
        except Exception as error:
            _set_job(job_id, "failed", None, str(error))
            raise  # keep the traceback in Modal's logs

    def _generate(self, image_bytes: bytes, job_id: str, params: GenerationParams) -> None:
        from PIL import Image

        from .export import to_glb

        _set_job(job_id, "processing", 5, "Decoding image")
        # RGBA is kept as is: an image that already has transparency skips
        # background removal entirely (`preprocess_image`).
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA")

        _set_job(job_id, "processing", 10, "Generating 3D structure")
        mesh = self._pipeline.run(image, seed=params.seed, pipeline_type=params.pipeline_type)[0]
        mesh.simplify(MAX_EXPORT_FACES)

        _set_job(job_id, "processing", 70, "Baking PBR textures")
        textured = to_glb(
            vertices=mesh.vertices,
            faces=mesh.faces,
            attr_volume=mesh.attrs,
            coords=mesh.coords,
            attr_layout=mesh.layout,
            voxel_size=mesh.voxel_size,
            aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
            decimation_target=params.decimation_target,
            texture_size=params.texture_size,
            # Upstream's example.py values for the remesh path.
            remesh=True,
            remesh_band=1,
            remesh_project=0,
        )

        _set_job(job_id, "processing", 95, "Writing GLB")
        buffer = io.BytesIO()
        # WebP textures, as upstream's example.py exports: a 4K PNG pair plus a
        # million-triangle mesh can reach the 100 MiB a Dict value may hold.
        textured.export(buffer, file_type="glb", extension_webp=True)

        artifact_store[job_id] = buffer.getvalue()
        _set_job(job_id, "succeeded", 100)
