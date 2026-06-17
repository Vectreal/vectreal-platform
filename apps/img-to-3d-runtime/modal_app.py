"""
Vectreal Image-to-3D Runtime — Modal entry point.

Architecture
────────────
modal_app.py  (this file)
  Defines the Modal app, all shared cloud resources (volumes, dicts, secrets),
  and both Docker images. Imported by inference.py and api.py for their
  @app.cls / @app.function decorators.

inference.py
  ImageTo3dInference — GPU class (A100). Loads TRELLIS.2-4B on container start,
  runs the three-stage pipeline, stores the GLB artifact in artifact_store.

api.py
  FastAPI web application (CPU). Handles auth, validates multipart image
  uploads, dispatches jobs to ImageTo3dInference.generate.spawn(), and serves
  job status / artifact downloads from Modal Dict.

Dependency flow (no circular imports):
  modal_app → inference → api

Usage
─────
Local dev (GPU runs in Modal cloud):
  pnpm nx run img-to-3d-runtime:modal-serve

Production deploy:
  pnpm nx run img-to-3d-runtime:modal-deploy

Secret setup (first time):
  pnpm nx run terraform:setup-modal-secrets
"""

from __future__ import annotations

import os

import modal

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

APP_NAME = "vectreal-img-to-3d-runtime"
app = modal.App(APP_NAME)

# ---------------------------------------------------------------------------
# Constants shared between inference.py and api.py
# ---------------------------------------------------------------------------

MODEL_ID = "microsoft/TRELLIS.2-4B"
HF_CACHE_DIR = "/vol/huggingface"
ALLOWED_MIME = frozenset({"image/png", "image/jpeg", "image/webp"})
DEFAULT_POLL_MS = 4_000

# ---------------------------------------------------------------------------
# Shared cloud resources
# ---------------------------------------------------------------------------

# Persists downloaded model weights across container lifecycles.
# First cold start: weights are fetched from HuggingFace (~15 GB) and committed.
# Subsequent starts: weights are loaded directly from the volume (fast).
model_volume = modal.Volume.from_name("img-to-3d-model-cache", create_if_missing=True)

# Distributed key-value stores for job state and binary artifacts.
# Both persist across function invocations and container restarts.
# NOTE: Modal Dict values have a practical size limit; very large GLBs (>50 MB)
# may require migrating artifact_store to Supabase Storage instead.
job_store = modal.Dict.from_name("img-to-3d-jobs", create_if_missing=True)
artifact_store = modal.Dict.from_name("img-to-3d-artifacts", create_if_missing=True)

# Created via: pnpm nx run terraform:setup-modal-secrets
# Required keys: IMG_TO_3D_RUNTIME_AUTH_SECRET
# Optional keys: IMG_TO_3D_MAX_IMAGE_BYTES, IMG_TO_3D_STATUS_POLL_MS, HF_TOKEN
runtime_secret = modal.Secret.from_name("img-to-3d-runtime-secret")

# ---------------------------------------------------------------------------
# Docker images
# ---------------------------------------------------------------------------

_HERE = os.path.dirname(os.path.abspath(__file__))

# --- CPU image (web layer) ---
# Small, fast cold start. Uses uv for reproducible installs from pyproject.toml.
web_image = (
    modal.Image.debian_slim(python_version="3.10")
    .add_local_file(os.path.join(_HERE, "pyproject.toml"), "/app/pyproject.toml", copy=True)
    .run_commands(
        "pip install uv",
        "cd /app && uv pip install --system '.[web]'",
    )
)

# --- GPU image (inference layer) ---
# Large (~20 GB+). Modal caches each layer between deploys; only changed layers
# are rebuilt. The flash-attn compile step alone takes ~20 minutes on first build.
gpu_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04",
        add_python="3.10",
    )
    .add_local_file(os.path.join(_HERE, "pyproject.toml"), "/app/pyproject.toml", copy=True)
    .apt_install(
        "git",
        "libjpeg-dev",
        "libgl1",
        "libglib2.0-0",
        "ninja-build",
        "build-essential",
        "wget",
    )
    # Install pip-resolvable GPU deps via uv (much faster than plain pip).
    # Compiled extensions below require source builds and use pip directly.
    # wheel+setuptools are required for --no-build-isolation installs below.
    .run_commands(
        "pip install uv wheel setuptools",
        "cd /app && uv pip install --system '.[gpu]'",
    )
    # Build-time only: compiler selection and CUDA arch.
    # Kept separate from runtime env so tweaking runtime vars never busts
    # the expensive compile cache below.
    .env(
        {
            "TORCH_CUDA_ARCH_LIST": "8.0 8.6 9.0",
            "CXX": "g++",
            "CC": "gcc",
        }
    )
    # flash-attn: CUDA attention kernel — long compile, cached after first build
    .run_commands("pip install flash-attn==2.7.3 --no-build-isolation")
    # nvdiffrast: differentiable rasteriser used inside to_glb()
    .run_commands(
        "git clone --depth 1 --branch v0.4.0 "
        "https://github.com/NVlabs/nvdiffrast.git /tmp/nvdiffrast "
        "&& pip install /tmp/nvdiffrast --no-build-isolation"
    )
    # nvdiffrec: PBR material baker (renderutils branch, used by to_glb)
    .run_commands(
        "git clone --depth 1 --branch renderutils "
        "https://github.com/JeffreyXiang/nvdiffrec.git /tmp/nvdiffrec "
        "&& pip install /tmp/nvdiffrec --no-build-isolation"
    )
    # CuMesh: CUDA mesh utilities (simplifcation, remeshing)
    # --recursive required for the cubvh submodule (third_party/cubvh)
    .run_commands(
        "git clone --recursive https://github.com/JeffreyXiang/CuMesh.git /tmp/cumesh "
        "&& pip install /tmp/cumesh --no-build-isolation"
    )
    # FlexGEMM: sparse convolution kernel used by the SLAT decoder
    # MAX_JOBS=2 limits parallel CUDA compilations to avoid OOM in build containers
    .run_commands(
        "git clone https://github.com/JeffreyXiang/FlexGEMM.git /tmp/flexgemm "
        "&& MAX_JOBS=2 pip install /tmp/flexgemm --no-build-isolation"
    )
    # TRELLIS.2 repo — o-voxel is the installable sub-package; the main trellis2
    # module has no setup.py/pyproject.toml so it can't be pip-installed.
    # It is added to PYTHONPATH via the env() call below instead.
    .run_commands(
        "git clone --recursive https://github.com/microsoft/TRELLIS.2.git /app/trellis2",
        "pip install /app/trellis2/o-voxel --no-build-isolation",
    )
    # Runtime env — placed last so changes here never invalidate compile layers.
    # /root: Modal mounts api.py/inference.py here; not on sys.path by default.
    # /app/trellis2: TRELLIS.2 has no pyproject.toml so can't be pip-installed.
    .env(
        {
            "ATTN_BACKEND": "flash-attn",
            "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True",
            "HF_HOME": HF_CACHE_DIR,
            "PYTHONPATH": "/root:/app/trellis2",
        }
    )
)

# ---------------------------------------------------------------------------
# Register GPU and web functions by importing their modules.
# The @app.cls / @app.function decorators run at import time, binding each
# class/function to this app object. Modal discovers them when traversing imports.
#
# Neither inference.py nor api.py is mounted alongside modal_app.py in
# containers — Modal only mounts the file that defines each function.
# Both files use try/except ModuleNotFoundError to import from modal_app when
# available (local machine) and fall back to self-contained definitions when
# running inside their respective containers.
# ---------------------------------------------------------------------------

from inference import ImageTo3dInference  # noqa: E402, F401
from api import api  # noqa: E402, F401
