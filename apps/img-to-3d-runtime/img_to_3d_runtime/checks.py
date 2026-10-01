"""
GPU self-check for the PyTorch3D texture bake that replaces nvdiffrast.

    uv run --extra dev modal run -m img_to_3d_runtime.checks

Bakes a quad whose 3D position equals its own UV, so the right answer for every
texel is known exactly: texel (row i, column j) must land on
u = (j + 0.5) / S, v = (i + 0.5) / S, the mapping upstream's nvdiffrast call
produced. A flipped axis would bake every texture mirrored, and no other test
here runs on a GPU, so this is the check that would catch it.

Not part of the deployed app: `app.py` does not import this module.
"""

from __future__ import annotations

from .infra import app, gpu_image

TEXTURE_SIZE = 64


@app.function(image=gpu_image, gpu="A10", timeout=600)
def check_uv_bake() -> str:
    import torch

    from .export import _rasterize_uv_space, interpolate_texel_positions

    # Two triangles covering UV [0.1, 0.9]^2, deliberately not the full square
    # so the empty border is checked too. Position = (u, v, 0).
    uvs = torch.tensor([[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]], device="cuda")
    vertices = torch.cat([uvs, torch.zeros(4, 1, device="cuda")], dim=-1)
    faces = torch.tensor([[0, 1, 2], [0, 2, 3]], device="cuda")

    face_ids, barycentrics = _rasterize_uv_space(uvs, faces, TEXTURE_SIZE)
    mask = face_ids >= 0

    rows, cols = torch.nonzero(mask, as_tuple=True)
    expected_u = (cols.float() + 0.5) / TEXTURE_SIZE
    expected_v = (rows.float() + 0.5) / TEXTURE_SIZE
    positions = interpolate_texel_positions(vertices, faces, face_ids[mask], barycentrics[mask])

    max_error = max(
        (positions[:, 0] - expected_u).abs().max().item(),
        (positions[:, 1] - expected_v).abs().max().item(),
    )
    assert max_error < 1e-4, f"texel positions are off by up to {max_error}: the UV mapping is flipped or shifted"

    # Coverage: texel centres strictly inside [0.1, 0.9] in both axes. Texels
    # on the diagonal (row == column) are skipped: their centres lie exactly on
    # the edge the two triangles share, and PyTorch3D treats a centre on an
    # edge as inside neither (all barycentrics must be strictly positive), so
    # whether they are covered is rounding, not mapping.
    centres = (torch.arange(TEXTURE_SIZE, device="cuda").float() + 0.5) / TEXTURE_SIZE
    inside = (centres > 0.1) & (centres < 0.9)
    expected_mask = inside[:, None] & inside[None, :]
    off_diagonal = ~torch.eye(TEXTURE_SIZE, dtype=torch.bool, device="cuda")
    mismatched = ((mask != expected_mask) & off_diagonal).sum().item()
    assert mismatched == 0, f"{mismatched} texels covered differently from the quad's UV footprint"

    return f"UV bake OK: {int(mask.sum())} texels, max position error {max_error:.2e}"


@app.local_entrypoint()
def main() -> None:
    print(check_uv_bake.remote())
