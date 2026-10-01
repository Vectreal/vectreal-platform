# Image-to-3D runtime

Turns one product photo into one textured GLB with
[TRELLIS.2-4B](https://huggingface.co/microsoft/TRELLIS.2-4B), on a Modal GPU.
It is internal sales tooling: the platform is its only client, and only
accounts enabled by a PostHog flag reach it there.

## Layout

| Module | Role |
| --- | --- |
| `img_to_3d_runtime/config.py` | Every pin (weights, source SHAs, packages) and resource name |
| `img_to_3d_runtime/infra.py` | The Modal app, Volume, Dicts, secret and both images |
| `img_to_3d_runtime/inference.py` | `ImageTo3dInference`: loads the pipeline once per container, one GLB per call |
| `img_to_3d_runtime/export.py` | Upstream's `to_glb`, vendored, baking textures with PyTorch3D instead of nvdiffrast |
| `img_to_3d_runtime/web.py` | The HTTP API as a plain FastAPI factory, tested without Modal |
| `img_to_3d_runtime/api.py` | Wires the API to Modal behind proxy auth |
| `img_to_3d_runtime/app.py` | Deploy entry point |
| `img_to_3d_runtime/checks.py` | GPU self-check for the texture bake, never deployed |
| `stubs/nvdiffrast/` | Lets TRELLIS.2 import without nvdiffrast; raises if anything calls it |

## Licensing

The output is used commercially, so three things TRELLIS.2 ships with are not
used:

| Component | License | Instead |
| --- | --- | --- |
| nvdiffrast | NVIDIA Source Code License-NC | PyTorch3D (BSD-3) rasterizes in UV space in `export.py` |
| nvdiffrec | NVIDIA Source Code License-NC | Not installed; the export never called it |
| briaai/RMBG-2.0 | CC BY-NC 4.0 | ZhengPeng7/BiRefNet (MIT), the model RMBG-2.0 was fine-tuned from |

`tests/test_licenses.py` fails if any of them comes back. Everything else is
permissive: TRELLIS.2 code and weights, CuMesh, cubvh, xatlas, FlexGEMM and
utils3d (MIT), Eigen (MPL-2.0), flash-attn and PyTorch (BSD), and DINOv3 (Meta's
DINOv3 License, commercial use allowed).

## HTTP API

Every request needs a Modal proxy token, as `Modal-Key` / `Modal-Secret`
headers. Modal rejects anything else before it reaches the container.

- `POST /generations`, multipart: `jobId` (UUID, chosen by the caller), `image`
  (PNG, JPEG or WebP), `seed`, `resolution` (512, 1024, 1536), `textureSize`
  (1024, 2048, 4096), `decimationTarget` (10,000 to 1,000,000). Answers `202`
  with `{ jobId, status: "queued", pollAfterMs }`. An image with transparency
  skips background removal.
- `GET /generations/{jobId}`: `{ jobId, status, progress, message, artifactReady, pollAfterMs }`,
  where `status` is `queued`, `processing`, `succeeded` or `failed`.
- `GET /generations/{jobId}/artifact`: the GLB once `artifactReady` is true.

Errors are `{ success: false, error }`.

## Commands

```bash
pnpm nx run img-to-3d-runtime:test            # pytest, CPU only, Modal not needed
pnpm nx run terraform:setup-modal-secrets     # once: HF_TOKEN into Modal
pnpm nx run img-to-3d-runtime:modal-deploy    # first build ~30+ min (CUDA compiles)
pnpm nx run img-to-3d-runtime:modal-check     # bakes a known quad on a GPU
pnpm nx run img-to-3d-runtime:modal-logs
```

Merging to `main` deploys through `cd-img-to-3d-runtime-production.yaml`.
