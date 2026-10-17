/* vectreal-core | @vctrl/core
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>. */

import type { BufferAttribute, Material, Mesh, Object3D } from 'three'
import type {
	GLTF,
	GLTFLoader,
	GLTFLoaderPlugin
} from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * The highest vertex alpha a `COLOR_0` can carry everywhere and still be read
 * as color.
 *
 * glTF multiplies `COLOR_0` into the base color, alpha included, and three,
 * Blender and every other conforming reader do exactly that. Sketchfab's GLB
 * export writes a `COLOR_0` that is not color: its alpha sits between 0 and
 * 16/255 on every vertex, and its RGB is a bake that runs down to black. The
 * Sketchfab viewer leaves vertex colors off, so the model looks right there and
 * nowhere else: glass with an alpha of 0.25 renders at a sixteenth of that or less, which
 * is invisible, and textured trim is multiplied toward black.
 *
 * A writer that means color writes alpha 1 where it has nothing to say. A
 * primitive whose every vertex is below a tenth opaque is one nobody can see,
 * so no file means that; reading it as "this attribute is not color" costs
 * nothing a real model uses.
 */
const NON_COLOR_ALPHA = 0.1

/**
 * Whether a `COLOR_0` is the kind above: four components, and no vertex at or
 * above `NON_COLOR_ALPHA`. A three-component attribute states no alpha, so
 * there is nothing to judge it by and it is always read as color.
 */
export function carriesNoColor(attribute: BufferAttribute): boolean {
	if (attribute.itemSize !== 4) return false

	for (let index = 0; index < attribute.count; index++) {
		if (attribute.getW(index) >= NON_COLOR_ALPHA) return false
	}

	return true
}

/**
 * Turns vertex colors off for every mesh whose `COLOR_0` carries no color.
 *
 * The viewer's decision, not the file's: the attribute stays in the geometry
 * untouched, so an export writes back exactly what arrived, which is what
 * Sketchfab's own toggle does. It is applied in the loader rather than to the
 * glTF-Transform document because a published scene, and an original kept as
 * is, reach the screen without ever becoming a document.
 *
 * A material is swapped rather than edited: `GLTFLoader` shares one
 * vertex-colored material across every primitive of a glTF material, and a
 * primitive whose colors are real must keep it.
 *
 * Exported for its own test. Package-internal; the barrel does not re-export
 * it.
 */
export function ignoreNonColorVertexColors(root: Object3D): void {
	const withoutColors = new Map<Material, Material>()

	const plain = (material: Material): Material => {
		if (!(material as Material & { vertexColors?: boolean }).vertexColors) {
			return material
		}

		let copy = withoutColors.get(material)
		if (!copy) {
			copy = material.clone()
			;(copy as Material & { vertexColors: boolean }).vertexColors = false
			withoutColors.set(material, copy)
		}
		return copy
	}

	root.traverse((node) => {
		const mesh = node as Mesh
		if (!mesh.isMesh) return

		const color = mesh.geometry.getAttribute('color') as
			BufferAttribute | undefined
		if (!color || !carriesNoColor(color)) return

		mesh.material = Array.isArray(mesh.material)
			? mesh.material.map(plain)
			: plain(mesh.material)
	})
}

/** Registers `ignoreNonColorVertexColors` on a loader, run on every parse. */
export function registerNonColorVertexColors(loader: GLTFLoader): void {
	loader.register((): GLTFLoaderPlugin => ({
		name: 'vectreal_non_color_vertex_colors',
		afterRoot: async (result: GLTF) => {
			for (const scene of result.scenes) ignoreNonColorVertexColors(scene)
		}
	}))
}
