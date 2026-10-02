"""
A stand-in for NVIDIA's nvdiffrast, so TRELLIS.2 can be imported without it.

nvdiffrast is licensed for research and evaluation only, and this runtime makes
models for commercial use, so it is never installed. TRELLIS.2 still imports it
unconditionally: the shape decoder imports `o_voxel.convert`, and
`o_voxel/__init__.py` imports `o_voxel.postprocess`, whose first lines are
`import nvdiffrast.torch as dr`. Nothing on our inference path calls it -
`img_to_3d_runtime/export.py` replaces the one function that did.

So the import succeeds and any use fails loudly, naming why.
"""
