"""
GLB export for TRELLIS.2 output, without nvdiffrast.

Vendored from `o-voxel/o_voxel/postprocess.py` at TRELLIS.2 commit
75fbf0183001ed9876c8dbb35de6b68552ee08bd, which is:

    MIT License
    Copyright (c) Microsoft Corporation.

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

Why it is vendored: upstream bakes textures with nvdiffrast, whose license
(NVIDIA Source Code License-NC, section 3.3) allows research and evaluation
only, and producing models for sales demos is commercial use. nvdiffrast does
exactly one job here, a rasterization in UV space that answers "which triangle,
at which barycentric weights, covers this texel". `_rasterize_uv_space` answers
the same question with PyTorch3D (BSD-3). Everything else is upstream's code,
kept as close to the original as the change allows so it can be diffed against
a future upstream revision.

Heavy imports (torch, cumesh, pytorch3d, ...) happen inside the functions that
need them, so `interpolate_texel_positions` can be unit-tested on a CPU with
only numpy installed.
"""

from __future__ import annotations

from typing import Any, Dict, Union

import numpy as np

# Upstream rasterizes in chunks of this many faces to bound memory.
RASTER_CHUNK_FACES = 100_000


def interpolate_texel_positions(vertices: Any, faces: Any, face_ids: Any, barycentrics: Any) -> Any:
    """
    3D position of each covered texel: the barycentric blend of the corners of
    the triangle that covers it. This is what `dr.interpolate` computed.

    Works on numpy arrays and torch tensors alike (indexing, `*` and a
    positional `.sum(-2)` mean the same in both).

    Args:
        vertices: (V, 3) vertex positions
        faces: (F, 3) vertex indices
        face_ids: (N,) index into `faces` for each covered texel
        barycentrics: (N, 3) weights of each texel's triangle corners, in the
            same order as that face's vertex indices
    """
    corners = vertices[faces[face_ids]]  # (N, 3 corners, 3 coords)
    return (corners * barycentrics[..., None]).sum(-2)


def _rasterize_uv_space(uvs: Any, faces: Any, texture_size: int) -> tuple[Any, Any]:
    """
    For every texel of a `texture_size` square texture, the face covering it
    (-1 where none does) and that face's barycentric weights.

    Texel (row i, column j) samples UV (u, v) = ((j + 0.5) / S, (i + 0.5) / S),
    which is the texel-to-UV mapping upstream's nvdiffrast call produced from
    clip coordinates `uv * 2 - 1`.

    PyTorch3D's NDC has +X pointing left and +Y pointing up, with the top-left
    pixel centre at (+1 - 1/S, +1 - 1/S). Placing each vertex at
    (1 - 2u, 1 - 2v) therefore lands texel (i, j) exactly on (u, v) above.
    `checks.py` asserts this on a GPU, because a flipped axis here would bake
    every texture mirrored and nothing else would notice.
    """
    import torch
    from pytorch3d.renderer.mesh.rasterize_meshes import rasterize_meshes
    from pytorch3d.structures import Meshes

    device = uvs.device
    ndc = torch.stack(
        [1 - 2 * uvs[:, 0], 1 - 2 * uvs[:, 1], torch.ones_like(uvs[:, 0])],
        dim=-1,
    ).float()
    faces = faces.long()

    face_ids = torch.full((texture_size, texture_size), -1, dtype=torch.long, device=device)
    barycentrics = torch.zeros((texture_size, texture_size, 3), dtype=torch.float32, device=device)

    for start in range(0, faces.shape[0], RASTER_CHUNK_FACES):
        chunk = faces[start : start + RASTER_CHUNK_FACES]
        pix_to_face, _, bary, _ = rasterize_meshes(
            Meshes(verts=[ndc], faces=[chunk]),
            image_size=texture_size,
            blur_radius=0.0,
            faces_per_pixel=1,
            # A UV atlas does not overlap, but its charts can crowd one bin.
            # Sized to the chunk so the coarse pass can never overflow.
            max_faces_per_bin=int(chunk.shape[0]),
            perspective_correct=False,
            cull_backfaces=False,
        )
        hit = pix_to_face[0, ..., 0] >= 0
        # pix_to_face indexes this chunk's faces; offset it back to the mesh.
        face_ids[hit] = pix_to_face[0, ..., 0][hit] + start
        barycentrics[hit] = bary[0, ..., 0, :][hit]

    return face_ids, barycentrics


def to_glb(
    vertices,
    faces,
    attr_volume,
    coords,
    attr_layout: Dict[str, slice],
    aabb,
    voxel_size: Union[float, list, tuple, np.ndarray, Any] = None,
    grid_size: Union[int, list, tuple, np.ndarray, Any] = None,
    decimation_target: int = 1000000,
    texture_size: int = 2048,
    remesh: bool = False,
    remesh_band: float = 1,
    remesh_project: float = 0.9,
    mesh_cluster_threshold_cone_half_angle_rad=np.radians(90.0),
    mesh_cluster_refine_iterations=0,
    mesh_cluster_global_iterations=1,
    mesh_cluster_smooth_strength=1,
    verbose: bool = False,
):
    """
    Convert an extracted mesh to a GLB-ready trimesh.
    Performs cleaning, optional remeshing, UV unwrapping, and texture baking from a volume.

    Arguments are upstream's, less `use_tqdm`.
    """
    import cv2
    import cumesh
    import torch
    import trimesh
    import trimesh.visual
    from flex_gemm.ops.grid_sample import grid_sample_3d
    from PIL import Image

    # --- Input Normalization (AABB, Voxel Size, Grid Size) ---
    if isinstance(aabb, (list, tuple)):
        aabb = np.array(aabb)
    if isinstance(aabb, np.ndarray):
        aabb = torch.tensor(aabb, dtype=torch.float32, device=coords.device)
    assert isinstance(aabb, torch.Tensor), f"aabb must be a list, tuple, np.ndarray, or torch.Tensor, but got {type(aabb)}"
    assert aabb.dim() == 2, f"aabb must be a 2D tensor, but got {aabb.shape}"
    assert aabb.size(0) == 2, f"aabb must have 2 rows, but got {aabb.size(0)}"
    assert aabb.size(1) == 3, f"aabb must have 3 columns, but got {aabb.size(1)}"

    # Calculate grid dimensions based on AABB and voxel size
    if voxel_size is not None:
        if isinstance(voxel_size, float):
            voxel_size = [voxel_size, voxel_size, voxel_size]
        if isinstance(voxel_size, (list, tuple)):
            voxel_size = np.array(voxel_size)
        if isinstance(voxel_size, np.ndarray):
            voxel_size = torch.tensor(voxel_size, dtype=torch.float32, device=coords.device)
        grid_size = ((aabb[1] - aabb[0]) / voxel_size).round().int()
    else:
        assert grid_size is not None, "Either voxel_size or grid_size must be provided"
        if isinstance(grid_size, int):
            grid_size = [grid_size, grid_size, grid_size]
        if isinstance(grid_size, (list, tuple)):
            grid_size = np.array(grid_size)
        if isinstance(grid_size, np.ndarray):
            grid_size = torch.tensor(grid_size, dtype=torch.int32, device=coords.device)
        voxel_size = (aabb[1] - aabb[0]) / grid_size

    # Assertions for dimensions
    assert isinstance(voxel_size, torch.Tensor)
    assert voxel_size.dim() == 1 and voxel_size.size(0) == 3
    assert isinstance(grid_size, torch.Tensor)
    assert grid_size.dim() == 1 and grid_size.size(0) == 3

    if verbose:
        print(f"Original mesh: {vertices.shape[0]} vertices, {faces.shape[0]} faces")

    # Move data to GPU
    vertices = vertices.cuda()
    faces = faces.cuda()

    # Initialize CUDA mesh handler
    mesh = cumesh.CuMesh()
    mesh.init(vertices, faces)

    # --- Initial Mesh Cleaning ---
    # Fills holes as much as we can before processing
    mesh.fill_holes(max_hole_perimeter=3e-2)
    if verbose:
        print(f"After filling holes: {mesh.num_vertices} vertices, {mesh.num_faces} faces")
    vertices, faces = mesh.read()

    # Build BVH for the current mesh to guide remeshing
    bvh = cumesh.cuBVH(vertices, faces)

    # --- Branch 1: Standard Pipeline (Simplification & Cleaning) ---
    if not remesh:
        # Step 1: Aggressive simplification (3x target)
        mesh.simplify(decimation_target * 3, verbose=verbose)

        # Step 2: Clean up topology (duplicates, non-manifolds, isolated parts)
        mesh.remove_duplicate_faces()
        mesh.repair_non_manifold_edges()
        mesh.remove_small_connected_components(1e-5)
        mesh.fill_holes(max_hole_perimeter=3e-2)

        # Step 3: Final simplification to target count
        mesh.simplify(decimation_target, verbose=verbose)

        # Step 4: Final Cleanup loop
        mesh.remove_duplicate_faces()
        mesh.repair_non_manifold_edges()
        mesh.remove_small_connected_components(1e-5)
        mesh.fill_holes(max_hole_perimeter=3e-2)

        # Step 5: Unify face orientations
        mesh.unify_face_orientations()

    # --- Branch 2: Remeshing Pipeline ---
    else:
        center = aabb.mean(dim=0)
        scale = (aabb[1] - aabb[0]).max().item()
        resolution = grid_size.max().item()

        # Perform Dual Contouring remeshing (rebuilds topology)
        mesh.init(*cumesh.remeshing.remesh_narrow_band_dc(
            vertices, faces,
            center=center,
            scale=(resolution + 3 * remesh_band) / resolution * scale,
            resolution=resolution,
            band=remesh_band,
            project_back=remesh_project,  # Snaps vertices back to original surface
            verbose=verbose,
            bvh=bvh,
        ))

        # Simplify and clean the remeshed result (similar logic to above)
        mesh.simplify(decimation_target, verbose=verbose)

    if verbose:
        print(f"Before UV unwrap: {mesh.num_vertices} vertices, {mesh.num_faces} faces")

    # --- UV Parameterization ---
    out_vertices, out_faces, out_uvs, out_vmaps = mesh.uv_unwrap(
        compute_charts_kwargs={
            "threshold_cone_half_angle_rad": mesh_cluster_threshold_cone_half_angle_rad,
            "refine_iterations": mesh_cluster_refine_iterations,
            "global_iterations": mesh_cluster_global_iterations,
            "smooth_strength": mesh_cluster_smooth_strength,
        },
        return_vmaps=True,
        verbose=verbose,
    )
    out_vertices = out_vertices.cuda()
    out_faces = out_faces.cuda()
    out_uvs = out_uvs.cuda()
    out_vmaps = out_vmaps.cuda()
    mesh.compute_vertex_normals()
    out_normals = mesh.read_vertex_normals()[out_vmaps]

    # --- Texture Baking (Attribute Sampling) ---
    # The one departure from upstream: PyTorch3D instead of nvdiffrast.
    face_ids, barycentrics = _rasterize_uv_space(out_uvs, out_faces, texture_size)

    # Mask of valid pixels in texture
    mask = face_ids >= 0

    # Interpolate 3D positions in UV space (finding 3D coord for every texel)
    valid_pos = interpolate_texel_positions(
        out_vertices, out_faces.long(), face_ids[mask], barycentrics[mask]
    )

    # Map these positions back to the *original* high-res mesh to get accurate attributes
    # This corrects geometric errors introduced by simplification/remeshing
    _, face_id, uvw = bvh.unsigned_distance(valid_pos, return_uvw=True)
    orig_tri_verts = vertices[faces[face_id.long()]]  # (N_new, 3, 3)
    valid_pos = (orig_tri_verts * uvw.unsqueeze(-1)).sum(dim=1)

    # Trilinear sampling from the attribute volume (Color, Material props)
    attrs = torch.zeros(texture_size, texture_size, attr_volume.shape[1], device='cuda')
    attrs[mask] = grid_sample_3d(
        attr_volume,
        torch.cat([torch.zeros_like(coords[:, :1]), coords], dim=-1),
        shape=torch.Size([1, attr_volume.shape[1], *grid_size.tolist()]),
        grid=((valid_pos - aabb[0]) / voxel_size).reshape(1, -1, 3),
        mode='trilinear',
    )

    # --- Texture Post-Processing & Material Construction ---
    mask = mask.cpu().numpy()

    # Extract channels based on layout (BaseColor, Metallic, Roughness, Alpha)
    base_color = np.clip(attrs[..., attr_layout['base_color']].cpu().numpy() * 255, 0, 255).astype(np.uint8)
    metallic = np.clip(attrs[..., attr_layout['metallic']].cpu().numpy() * 255, 0, 255).astype(np.uint8)
    roughness = np.clip(attrs[..., attr_layout['roughness']].cpu().numpy() * 255, 0, 255).astype(np.uint8)
    alpha = np.clip(attrs[..., attr_layout['alpha']].cpu().numpy() * 255, 0, 255).astype(np.uint8)
    alpha_mode = 'OPAQUE'

    # Inpainting: fill gaps (dilation) to prevent black seams at UV boundaries
    mask_inv = (~mask).astype(np.uint8)
    base_color = cv2.inpaint(base_color, mask_inv, 3, cv2.INPAINT_TELEA)
    metallic = cv2.inpaint(metallic, mask_inv, 1, cv2.INPAINT_TELEA)[..., None]
    roughness = cv2.inpaint(roughness, mask_inv, 1, cv2.INPAINT_TELEA)[..., None]
    alpha = cv2.inpaint(alpha, mask_inv, 1, cv2.INPAINT_TELEA)[..., None]

    # Create PBR material
    # Standard PBR packs Metallic and Roughness into Blue and Green channels
    material = trimesh.visual.material.PBRMaterial(
        baseColorTexture=Image.fromarray(np.concatenate([base_color, alpha], axis=-1)),
        baseColorFactor=np.array([255, 255, 255, 255], dtype=np.uint8),
        metallicRoughnessTexture=Image.fromarray(np.concatenate([np.zeros_like(metallic), roughness, metallic], axis=-1)),
        metallicFactor=1.0,
        roughnessFactor=1.0,
        alphaMode=alpha_mode,
        doubleSided=True if not remesh else False,
    )

    # --- Coordinate System Conversion & Final Object ---
    vertices_np = out_vertices.cpu().numpy()
    faces_np = out_faces.cpu().numpy()
    uvs_np = out_uvs.cpu().numpy()
    normals_np = out_normals.cpu().numpy()

    # Swap Y and Z axes, invert Y (common conversion for GLB compatibility)
    vertices_np[:, 1], vertices_np[:, 2] = vertices_np[:, 2], -vertices_np[:, 1]
    normals_np[:, 1], normals_np[:, 2] = normals_np[:, 2], -normals_np[:, 1]
    uvs_np[:, 1] = 1 - uvs_np[:, 1]  # Flip UV V-coordinate

    return trimesh.Trimesh(
        vertices=vertices_np,
        faces=faces_np,
        vertex_normals=normals_np,
        process=False,
        visual=trimesh.visual.TextureVisuals(uv=uvs_np, material=material),
    )
