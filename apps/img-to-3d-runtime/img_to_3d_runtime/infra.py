"""
The Modal app, its cloud resources and both container images.

Defined once and imported by `inference.py`, `api.py` and `checks.py`. Since
Modal 1.0 nothing is automounted: a container only has the source the image
adds, so both images add this package with `add_local_python_source`. That is
what lets every module here import its siblings normally, inside and outside a
container.
"""

from __future__ import annotations

from pathlib import Path

import modal

from .config import (
    APP_NAME,
    ARTIFACT_STORE_NAME,
    CUMESH_SHA,
    FLEXGEMM_SHA,
    HF_HOME,
    JOB_STORE_NAME,
    PYTORCH3D_TAG,
    SECRET_NAME,
    TRELLIS2_SHA,
    VOLUME_NAME,
    WEB_PACKAGES,
)

app = modal.App(APP_NAME)

model_volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

# Job state is a few hundred bytes per job, well within what a Dict is for.
# Artifacts are not: Modal recommends Dict values under 5 MiB and caps them at
# 100 MiB, and entries expire after 7 idle days. Moving artifacts to platform
# storage is the reliability change that follows this one.
job_store = modal.Dict.from_name(JOB_STORE_NAME, create_if_missing=True)
artifact_store = modal.Dict.from_name(ARTIFACT_STORE_NAME, create_if_missing=True)

# Holds HF_TOKEN, required: TRELLIS.2 conditions on facebook/dinov3, which is
# gated on Hugging Face. Created by `pnpm nx run terraform:setup-modal-secrets`.
runtime_secret = modal.Secret.from_name(SECRET_NAME)

_STUBS_DIR = Path(__file__).resolve().parent.parent / "stubs"

web_image = (
    modal.Image.debian_slim(python_version="3.11")
    .uv_pip_install(*WEB_PACKAGES)
    .add_local_python_source("img_to_3d_runtime")
)

# Versions follow TRELLIS.2's setup.sh at TRELLIS2_SHA: torch 2.6.0 on CUDA
# 12.4, flash-attn 2.7.3. Each compile step is its own layer, so changing a
# later step does not rebuild the expensive ones before it.
#
# Deliberately absent, for licensing: nvdiffrast and nvdiffrec (NVIDIA,
# research-only) and briaai/RMBG-2.0 (CC BY-NC). `tests/test_licenses.py`
# fails the build if one comes back.
gpu_image = (
    modal.Image.from_registry("nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04", add_python="3.10")
    .apt_install("git", "libjpeg-dev", "libgl1", "libglib2.0-0", "ninja-build", "build-essential")
    .uv_pip_install(
        "torch==2.6.0",
        "torchvision==0.21.0",
        index_url="https://download.pytorch.org/whl/cu124",
    )
    .uv_pip_install(
        # TRELLIS.2's runtime imports. Its setup.sh also installs gradio,
        # imageio, tensorboard, pandas and lpips; those serve the demo app,
        # training and the data toolkit, none of which inference imports.
        #
        # Pinned to the releases current at TRELLIS.2's last code change
        # (January 2026). transformers stays on 4.x: 5.0 shipped afterwards,
        # and DINOv3 and BiRefNet's remote code were written against 4.x.
        "tqdm==4.67.2",
        "easydict==1.13",
        "opencv-python-headless==4.13.0.90",
        "ninja==1.13.0",
        "trimesh==4.11.1",
        "transformers==4.57.6",
        "huggingface_hub==0.36.2",
        "zstandard==0.25.0",
        "plyfile==1.1.3",
        "kornia==0.8.2",
        "timm==1.0.24",
        "pydantic~=2.13",
        # PyTorch3D's runtime dependency.
        "iopath==0.1.10",
        "utils3d @ git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8",
    )
    # No GPU at build time, so the CUDA extensions are compiled for the
    # architectures named here rather than detected.
    .env(
        {
            "TORCH_CUDA_ARCH_LIST": "8.0 8.6 9.0",
            "FORCE_CUDA": "1",
            "CC": "gcc",
            "CXX": "g++",
        }
    )
    .run_commands("pip install wheel setuptools && pip install flash-attn==2.7.3 --no-build-isolation")
    # Replaces nvdiffrast for the UV-space rasterization in export.py.
    .run_commands(
        f"pip install 'git+https://github.com/facebookresearch/pytorch3d.git@{PYTORCH3D_TAG}' --no-build-isolation"
    )
    .run_commands(
        "git clone --recursive https://github.com/JeffreyXiang/CuMesh.git /tmp/cumesh"
        f" && git -C /tmp/cumesh checkout {CUMESH_SHA}"
        " && git -C /tmp/cumesh submodule update --init --recursive"
        " && pip install /tmp/cumesh --no-build-isolation"
    )
    .run_commands(
        "git clone --recursive https://github.com/JeffreyXiang/FlexGEMM.git /tmp/flexgemm"
        f" && git -C /tmp/flexgemm checkout {FLEXGEMM_SHA}"
        " && git -C /tmp/flexgemm submodule update --init --recursive"
        # Two parallel CUDA compiles keep the build container inside its memory.
        " && MAX_JOBS=2 pip install /tmp/flexgemm --no-build-isolation"
    )
    # TRELLIS.2 has no installable package, so its source sits on PYTHONPATH.
    # o-voxel is installed with --no-deps because it declares CuMesh and
    # FlexGEMM as unpinned git dependencies, which would silently replace the
    # pinned builds above; its other dependencies are listed explicitly above.
    .run_commands(
        "git clone --recursive https://github.com/microsoft/TRELLIS.2.git /app/trellis2"
        f" && git -C /app/trellis2 checkout {TRELLIS2_SHA}"
        " && git -C /app/trellis2 submodule update --init --recursive"
        " && pip install /app/trellis2/o-voxel --no-build-isolation --no-deps"
    )
    .env(
        {
            "ATTN_BACKEND": "flash_attn",
            "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True",
            "OPENCV_IO_ENABLE_OPENEXR": "1",
            "HF_HOME": HF_HOME,
            # The stub must come first so `import nvdiffrast` resolves to it.
            "PYTHONPATH": "/opt/stubs:/app/trellis2",
        }
    )
    .add_local_dir(_STUBS_DIR, "/opt/stubs")
    .add_local_python_source("img_to_3d_runtime")
)
