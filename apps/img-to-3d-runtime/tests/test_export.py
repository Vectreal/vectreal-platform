"""
The barycentric blend that replaced `dr.interpolate`. The rasterization that
feeds it needs a GPU and is checked by `img_to_3d_runtime/checks.py`.
"""

import numpy as np

from img_to_3d_runtime.export import interpolate_texel_positions

VERTICES = np.array([[0.0, 0.0, 0.0], [2.0, 0.0, 0.0], [0.0, 4.0, 0.0], [0.0, 0.0, 8.0]])
FACES = np.array([[0, 1, 2], [0, 2, 3]])


def test_corner_weights_return_the_corner():
    positions = interpolate_texel_positions(
        VERTICES, FACES, np.array([0, 0, 1]), np.array([[0, 1, 0], [0, 0, 1], [0, 0, 1]], dtype=float)
    )
    np.testing.assert_allclose(positions, [[2, 0, 0], [0, 4, 0], [0, 0, 8]])


def test_weights_follow_each_texel_s_own_face_and_vertex_order():
    weights = np.array([[0.2, 0.3, 0.5], [0.2, 0.3, 0.5]])
    positions = interpolate_texel_positions(VERTICES, FACES, np.array([0, 1]), weights)
    # Face 0 = (v0, v1, v2); face 1 = (v0, v2, v3).
    np.testing.assert_allclose(positions[0], 0.3 * VERTICES[1] + 0.5 * VERTICES[2])
    np.testing.assert_allclose(positions[1], 0.3 * VERTICES[2] + 0.5 * VERTICES[3])
