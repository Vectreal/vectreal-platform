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

/**
 * The optimization steps that are nothing but a list of glTF-Transform
 * transforms, which ModelOptimizer runs on a copy and commits.
 */

import { getBounds, Scene, Transform } from '@gltf-transform/core'
import {
	dedup,
	DedupOptions as GltfDedupOptions,
	normals,
	NormalsOptions as GltfNormalsOptions,
	quantize,
	QuantizeOptions as GltfQuantizeOptions,
	simplify,
	weld
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'

import {
	DedupOptions,
	NormalsOptions,
	PlacementOptions,
	QuantizeOptions,
	SimplifyOptions
} from './types'

export interface TransformPass<Options> {
	/** What the applied-steps list records it as. */
	name: string
	started: string
	finished: string
	transforms: (options: Options) => Transform[]
	/**
	 * Kept even when it makes the file larger. Every other pass exists to
	 * shrink the file, so a result that grows it is reverted.
	 */
	mayGrow?: boolean
}

export const simplifyPass: TransformPass<SimplifyOptions> = {
	name: 'simplification',
	started: 'Applying mesh simplification',
	finished: 'Mesh simplification complete',
	transforms: ({ ratio = 0.5, error = 0.001 }) => [
		weld(),
		simplify({ ratio, simplifier: MeshoptSimplifier, error })
	]
}

export const dedupPass: TransformPass<DedupOptions> = {
	name: 'deduplication',
	started: 'Applying deduplication',
	finished: 'Deduplication complete',
	transforms: (options) => [dedup(options as GltfDedupOptions)]
}

export const quantizePass: TransformPass<QuantizeOptions> = {
	name: 'quantization',
	started: 'Applying quantization',
	finished: 'Quantization complete',
	transforms: (options) => [quantize(options as GltfQuantizeOptions)]
}

export const normalsPass: TransformPass<NormalsOptions> = {
	name: 'normals optimization',
	started: 'Optimizing normals',
	finished: 'Normals optimization complete',
	transforms: (options) => [normals(options as GltfNormalsOptions)]
}

/**
 * Stands each scene on the ground at the origin: centered on X and Z, its
 * lowest point at y = 0, and scaled uniformly when a real-world size is given.
 * This is what AR viewers such as Quick Look and Shopify's own 3D slot expect,
 * since they place the model's origin on the floor at its true size.
 *
 * The scene's contents move under one new parent node, so the meshes, their
 * own transforms and any animation of them are left as they were. The node
 * adds a few bytes, which is why the pass may grow the file.
 *
 * Bounds are measured on the meshes' rest pose: a skinned mesh is placed by
 * where its vertices sit unposed, not where its joints would put them.
 */
export function placeOnGround({
	longestEdgeMeters
}: PlacementOptions = {}): Transform {
	return (document) => {
		const scenes = document.getRoot().listScenes()
		// Reparenting a node detaches it from every scene that lists it, so a
		// root shared by two scenes would vanish from the second.
		const shared = scenes
			.flatMap((scene) => scene.listChildren())
			.find(
				(node) =>
					node.listParents().filter((parent) => parent instanceof Scene)
						.length > 1
			)
		if (shared) {
			throw new Error(
				`Placement cannot move node "${shared.getName()}": more than one scene lists it`
			)
		}

		for (const scene of scenes) {
			const { min, max } = getBounds(scene)
			const longest = Math.max(
				max[0] - min[0],
				max[1] - min[1],
				max[2] - min[2]
			)
			// An empty scene has inverted infinite bounds: nothing to place.
			if (!Number.isFinite(longest) || longest <= 0) continue

			const scale = longestEdgeMeters ? longestEdgeMeters / longest : 1
			const placement = document
				.createNode('placement')
				.setScale([scale, scale, scale])
				.setTranslation([
					(-(min[0] + max[0]) / 2) * scale,
					-min[1] * scale,
					(-(min[2] + max[2]) / 2) * scale
				])
			for (const child of scene.listChildren()) {
				scene.removeChild(child)
				placement.addChild(child)
			}
			scene.addChild(placement)
		}
	}
}

export const placementPass: TransformPass<PlacementOptions> = {
	name: 'placement',
	started: 'Placing the model on the ground',
	finished: 'Placement complete',
	mayGrow: true,
	transforms: (options) => [placeOnGround(options)]
}
