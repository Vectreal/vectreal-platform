# Trellis Runtime

Serverless GPU inference service for [TRELLIS.2-4B](https://huggingface.co/microsoft/TRELLIS.2-4B) — image-to-3D model generation. Deployed on [Modal](https://modal.com) and consumed by the Vectreal platform via `apps/vectreal-platform/app/lib/domain/trellis/`.

## Architecture

```
modal_app.py   — App definition, shared cloud resources (volumes, dicts,
                 secrets), Docker image declarations for both layers.

inference.py   — GPU layer. TrellisInference class runs on A100 instances.
                 Loaded once per container; stays warm between jobs.

api.py         — CPU layer. Stateless FastAPI application. Validates multipart
                 image uploads, dispatches inference via .spawn(), serves
                 job status and GLB artifacts from Modal Dict.

pyproject.toml — Dependency manifest (managed with uv). Two extras:
                   [web]  — FastAPI + Pydantic (CPU layer)
                   [gpu]  — PyTorch, transformers, etc. (GPU layer)
                 Compiled extensions (flash-attn, nvdiffrast, nvdiffrec,
                 CuMesh, FlexGEMM, o-voxel, trellis2) are built from source
                 via run_commands in modal_app.py.
```

## TRELLIS.2 Pipeline

`pipeline.run(image)` executes three internal stages in sequence:

| Stage | What happens |
|-------|-------------|
| Sparse Structure Sampler | Generates a coarse 3D occupancy field from the image |
| Shape Latent Sampler | Refines geometry in the SLAT latent space |
| Texture Latent Sampler | Adds colour/material information to the latent |

After `pipeline.run()`:

- **`mesh.simplify(16_777_216)`** — Hard-clamps the face count to 2²⁴, the maximum nvdiffrast can process. Under normal model outputs this is a no-op; it guards against OOM in the rasteriser.
- **`o_voxel.postprocess.to_glb(...)`** — Bakes PBR textures (diffuse, normal, roughness) onto the decimated mesh using nvdiffrec, then serialises to GLB. The `texture_size=4096` and `remesh=True` parameters control quality here.

Approximate wall-clock times on NVIDIA H100 (A100 will be slower by ~30-50%):

| Resolution | Total | Shape | Materials |
|------------|-------|-------|-----------|
| 512³ | ~3 s | ~2 s | ~1 s |
| 1024³ | ~17 s | ~10 s | ~7 s |
| 1536³ | ~60 s | ~35 s | ~25 s |

## HTTP API

All endpoints require the `x-trellis-runtime-secret` header.

### `POST /generations`

Submit one or more images as `multipart/form-data`. Each image creates a separate job.

**Request**

```
Content-Type: multipart/form-data
x-trellis-runtime-secret: <secret>

images: <file>   (repeat for each image; PNG / JPEG / WebP, max 10 MB each)
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "jobs": [
      { "jobId": "uuid", "status": "queued", "pollAfterMs": 4000 }
    ]
  }
}
```

### `GET /generations/{jobId}`

Poll job status.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "processing",
    "progress": 70,
    "message": "Baking PBR textures",
    "artifactReady": false,
    "retryable": false,
    "pollAfterMs": 4000
  }
}
```

### `GET /generations/{jobId}/artifact`

Download the generated GLB file (binary, `model/gltf-binary`). Only available when `status === "succeeded"`.

## Local Development

Two modes — set in `.env.development`:

**Platform mock** (default, no Modal account or GPU needed):
```env
TRELLIS_MOCK_MODE=true
```
The platform fakes the full lifecycle in-process and returns a minimal valid GLB.

**Live Modal runtime** (real A100 inference):
```bash
# 1. Install Modal CLI and authenticate (once)
pip install modal && modal setup

# 2. Create the Modal secret
pnpm nx run terraform:setup-modal-secrets

# 3. Start a live tunnel — GPU functions run in Modal cloud
pnpm nx run trellis-runtime:modal-serve
# → prints: https://your-workspace--vectreal-trellis-runtime-api.modal.run

# 4. Point the platform at the tunnel URL
# .env.development:
TRELLIS_MOCK_MODE=
TRELLIS_RUNTIME_BASE_URL=https://your-workspace--vectreal-trellis-runtime-api.modal.run
TRELLIS_RUNTIME_AUTH_SECRET=<same value as TRELLIS_RUNTIME_AUTH_SECRET_PROD>
```

## Deployment

```bash
# Deploy to production
pnpm nx run trellis-runtime:modal-deploy
```

CI deploys automatically on push to `main` when `modal_app.py` changes (see `.github/workflows/cd-trellis-runtime-production.yaml`).

### First-time setup

```bash
pip install modal
modal setup                    # authenticate
pnpm nx run terraform:setup-modal-secrets  # create trellis-runtime-secret
pnpm nx run trellis-runtime:modal-deploy   # first deploy (image build ~40 min)
```

### GitHub Actions secrets required

| Secret | How to get it |
|--------|--------------|
| `MODAL_TOKEN_ID` | `modal token new` |
| `MODAL_TOKEN_SECRET` | `modal token new` |

## Dependency management

Dependencies are declared in `pyproject.toml` and installed with [uv](https://github.com/astral-sh/uv) inside the Modal image build. To add or update a dependency:

1. Edit `pyproject.toml`
2. Run `pnpm nx run trellis-runtime:modal-deploy` — Modal rebuilds only the affected image layers

The compiled extensions (flash-attn, nvdiffrast, etc.) are handled in `modal_app.py` via `run_commands` because they require source compilation against the CUDA toolkit and cannot be installed via `uv pip install`.
