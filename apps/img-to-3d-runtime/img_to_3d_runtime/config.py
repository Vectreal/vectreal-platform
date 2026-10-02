"""
Names, pins and paths shared by every module in the runtime.

The weights, the compiled extensions' sources and the background remover are
pinned here, and infra.py pins the GPU image's direct Python packages, so a
deploy next month builds the same thing as a deploy today. Upstream HEADs move,
and o-voxel in particular declares CuMesh and FlexGEMM as unpinned git
dependencies, so an unpinned build is a different program each time.

Not pinned: two sub-models TRELLIS.2 fetches by name at load time,
facebook/dinov3-vitl16-pretrain-lvd1689m and the microsoft/TRELLIS-image-large
decoder, and the image's transitive Python dependencies.
"""

APP_NAME = "vectreal-img-to-3d-runtime"
SECRET_NAME = "img-to-3d-runtime-secret"

# Model weights, pinned by Hugging Face revision.
MODEL_REPO = "microsoft/TRELLIS.2-4B"
MODEL_REVISION = "af44b45f2e35a493886929c6d786e563ec68364d"

# Background removal. TRELLIS.2's pipeline.json names briaai/RMBG-2.0, which
# is CC BY-NC 4.0 and cannot be used to make sales demos. BiRefNet is the MIT
# model RMBG-2.0 was fine-tuned from, and TRELLIS.2's own `rembg.BiRefNet`
# wrapper loads it unchanged; inference.py rewrites the config to point there.
REMBG_REPO = "ZhengPeng7/BiRefNet"
REMBG_REVISION = "e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4"

# Source pins for the compiled extensions. All MIT.
TRELLIS2_SHA = "75fbf0183001ed9876c8dbb35de6b68552ee08bd"
CUMESH_SHA = "12289e1062f0603f2f0d0771b02e1395d247f26f"
FLEXGEMM_SHA = "6dd94a859c26ee8246888502eada3dd8ad85532e"
PYTORCH3D_TAG = "v0.7.9"

# The Volume holds the weights so only the first cold start downloads them.
VOLUME_NAME = "img-to-3d-model-cache"
VOLUME_PATH = "/vol"
HF_HOME = f"{VOLUME_PATH}/huggingface"
MODEL_DIR = f"{VOLUME_PATH}/models/trellis2-4b-{MODEL_REVISION[:12]}"
REMBG_DIR = f"{VOLUME_PATH}/models/birefnet-{REMBG_REVISION[:12]}"
# Written next to the upstream pipeline.json rather than over it, so the
# snapshot stays byte-identical to the pinned revision.
PIPELINE_CONFIG = "pipeline.vectreal.json"

JOB_STORE_NAME = "img-to-3d-jobs"
ARTIFACT_STORE_NAME = "img-to-3d-artifacts"

# The web container's packages. `pyproject.toml`'s `web` extra must list the
# same strings, so the tests run against what deploys; a test compares them.
WEB_PACKAGES = (
    "fastapi[standard]~=0.142",
    "python-multipart~=0.0.32",
    "pydantic~=2.13",
)

ALLOWED_IMAGE_TYPES = frozenset({"image/png", "image/jpeg", "image/webp"})
DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024
DEFAULT_POLL_MS = 4_000

# The GPU function's own limit. 1536 at a 4K bake is the heaviest
# configuration, and the first live run decides whether this is generous.
GENERATION_TIMEOUT_S = 900
