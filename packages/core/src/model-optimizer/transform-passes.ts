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

import {
	Document,
	getBounds,
	type mat4,
	Node,
	Primitive,
	Scene,
	Transform
} from '@gltf-transform/core'
import {
	dedup,
	DedupOptions as GltfDedupOptions,
	flatten,
	join,
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
	 * Whether the result is worth committing. By default, when the file did
	 * not grow: most passes exist to shrink it, so one that grows it is
	 * reverted.
	 */
	keeps?: (change: PassChange) => boolean
}

/** A pass's result next to what it ran on. */
export interface PassChange {
	before: Document
	after: Document
	sizeBefore: number
	sizeAfter: number
}

/** The default: kept when the file is no larger. */
export const keepsWhenNoLarger = ({ sizeBefore, sizeAfter }: PassChange) =>
	sizeAfter <= sizeBefore

/**
 * How many primitives the scenes draw, each once per node that holds it. A
 * node no scene reaches draws nothing, and pruning it is no saving.
 */
const countDrawnPrimitives = (document: Document) => {
	let count = 0
	for (const scene of document.getRoot().listScenes()) {
		scene.traverse((node) => {
			count += node.getMesh()?.listPrimitives().length ?? 0
		})
	}
	return count
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

/**
 * Merges meshes that share a material into one, so the viewer draws each
 * material once rather than once per part. Imported CAD and car models are
 * often hundreds or thousands of small parts on a handful of materials: the
 * Porsche is 1,664 meshes on 20 materials, and every one is a draw call in
 * each pass of every frame.
 *
 * `flatten` lifts every node to the scene root, keeping its world transform,
 * so siblings across the old hierarchy can join; {@link placeStillParts}
 * writes each part's place into its vertices; `join` then merges primitives
 * with the same material and vertex layout into one. None of them touches an
 * animated node or anything below one, a joint or a skinned or morphing mesh,
 * so a clip still finds every node it moves. Vertices keep their own UVs, so
 * baked textures read the same.
 *
 * It may grow the file: a mesh reused by several nodes becomes one copy per
 * use, and joined indices can need a wider type. Its saving is in draw calls,
 * not bytes, so it is kept when the scene draws fewer primitives, and only
 * then.
 */
export const mergePass: TransformPass<void> = {
	name: 'mesh merging',
	started: 'Merging meshes',
	finished: 'Mesh merging complete',
	// Kept for fewer draws, whatever the size; with none fewer it changed
	// nothing worth keeping, and would leave quantized vertices as floats.
	keeps: ({ before, after }) =>
		countDrawnPrimitives(after) < countDrawnPrimitives(before),
	transforms: () => [flatten(), placeStillParts(), join({ filter: isJoinable })]
}

/** A node that does not move what it holds. */
const IDENTITY: mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

const isAtOrigin = (node: Node) =>
	node.getMatrix().every((value, i) => value === IDENTITY[i])

/**
 * Whether `join` may merge a part: one standing at the origin, so joining
 * moves none of its vertices, drawn as plain triangles, and with nothing on
 * its node or primitives that `join` would drop or spread to the others, such
 * as material variants or a node hidden by `KHR_node_visibility`. Strips,
 * fans and line strips join with primitive-restart indices, which three.js
 * does not read.
 */
const isJoinable = (node: Node) =>
	isAtOrigin(node) &&
	node.listExtensions().length === 0 &&
	(node.getMesh()?.listPrimitives() ?? []).every(
		(primitive) =>
			primitive.getMode() === Primitive.Mode['TRIANGLES'] &&
			primitive.listExtensions().length === 0
	)

/**
 * Moves the transform of every still part at the scene root into its
 * vertices, so the part's node stands at the origin.
 *
 * `join` merges only parts at the origin. Left to itself it would keep the
 * first part's node and move the others into its space, and a viewer measures
 * a mesh by its own box carried through its node: a rotated node gives a box
 * larger than the vertices, and the merged Porsche measured 2% of its height
 * lower than it is, the ground and the framing with it. At the origin, the box
 * a viewer measures is the vertices' own.
 *
 * The vertices are moved here rather than by glTF-Transform, whose 4.4.2
 * transform zeroes a quantized normal and rotates a tangent from its own
 * half-written result. Each part gets its own copy of what it moves, so a
 * mesh or accessor another part shares stays where it was.
 *
 * Left as they are: animated nodes, joints, skinned, morphing and instanced
 * meshes and nodes with children, which something else moves or hangs from;
 * a node carrying a camera or a light, which would move with it; a volume
 * material, whose thickness is measured in the mesh's own space; and a
 * mirrored part drawn as strips or fans, whose winding cannot be turned.
 */
export function placeStillParts(): Transform {
	return (document) => {
		const root = document.getRoot()
		const pinned = new Set<Node>([
			...root
				.listAnimations()
				.flatMap((animation) => animation.listChannels())
				.map((channel) => channel.getTargetNode())
				.filter((node): node is Node => node !== null),
			...root.listSkins().flatMap((skin) => skin.listJoints())
		])
		for (const scene of root.listScenes()) {
			for (const node of scene.listChildren()) {
				const mesh = node.getMesh()
				const matrix = node.getMatrix()
				const mirrored = determinant3(matrix) < 0
				if (
					!mesh ||
					isAtOrigin(node) ||
					pinned.has(node) ||
					node.getSkin() ||
					node.getCamera() ||
					node.listExtensions().length > 0 ||
					node.listChildren().length > 0 ||
					mesh
						.listPrimitives()
						.some(
							(primitive) =>
								primitive.listTargets().length > 0 ||
								primitive.getMaterial()?.getExtension('KHR_materials_volume') ||
								(mirrored &&
									primitive.getMode() !== Primitive.Mode['TRIANGLES'])
						)
				) {
					continue
				}
				// A copy keeps the mesh's name, extras and extensions.
				const placed = mesh.clone()
				for (const primitive of placed.listPrimitives()) {
					placed
						.removePrimitive(primitive)
						.addPrimitive(placePrimitive(primitive.clone(), matrix))
				}
				node.setMesh(placed).setMatrix(IDENTITY)
			}
		}
	}
}

/** Writes `matrix` into the primitive's own copies of what it moves. */
function placePrimitive(primitive: Primitive, matrix: mat4): Primitive {
	const [a, b, c, , d, e, f, , g, h, k] = matrix
	// The cofactors of the upper 3x3: its inverse transpose times its
	// determinant, which is how a normal moves.
	const cofactors = [
		e * k - f * h,
		f * g - d * k,
		d * h - e * g,
		c * h - b * k,
		a * k - c * g,
		b * g - a * h,
		b * f - c * e,
		c * d - a * f,
		a * e - b * d
	]
	const sign = Math.sign(determinant3(matrix)) || 1
	const linear = (v: number[], m: number[], stride: number) =>
		[0, 1, 2].map(
			(row) =>
				m[row] * v[0] + m[row + stride] * v[1] + m[row + 2 * stride] * v[2]
		)
	const unit = (v: number[]) => {
		const length = Math.hypot(v[0], v[1], v[2]) || 1
		return v.map((value) => value / length)
	}
	const moves: Record<string, (v: number[]) => number[]> = {
		POSITION: (v) =>
			linear(v, matrix, 4).map((value, i) => value + matrix[12 + i]),
		NORMAL: (v) => unit(linear(v, cofactors, 3).map((value) => value * sign)),
		TANGENT: (v) => [...unit(linear(v, matrix, 4)), (v[3] ?? 1) * sign]
	}
	for (const [semantic, move] of Object.entries(moves)) {
		const source = primitive.getAttribute(semantic)
		if (!source) continue
		const size = source.getElementSize()
		const moved = new Float32Array(source.getCount() * size)
		const element: number[] = []
		for (let i = 0; i < source.getCount(); i++) {
			moved.set(move(source.getElement(i, element)), i * size)
		}
		primitive.setAttribute(
			semantic,
			source.clone().setArray(moved).setNormalized(false)
		)
	}
	if (sign < 0 && primitive.getMode() === Primitive.Mode['TRIANGLES']) {
		turnWinding(primitive)
	}
	return primitive
}

/** Turns every triangle's corners the other way round, in its own indices. */
function turnWinding(primitive: Primitive): void {
	const count = primitive.getAttribute('POSITION')?.getCount() ?? 0
	const source = primitive.getIndices()
	const indices = source
		? Array.from(source.getArray() ?? [])
		: Array.from({ length: count }, (_, i) => i)
	for (let i = 0; i + 2 < indices.length; i += 3) {
		;[indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
	}
	const array =
		count > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)
	primitive.setIndices(
		(source
			? source.clone()
			: Document.fromGraph(primitive.getGraph())!
					.createAccessor()
					.setType('SCALAR')
		).setArray(array)
	)
}

/** The determinant of a matrix's upper 3x3: below zero, it mirrors. */
const determinant3 = ([a, b, c, , d, e, f, , g, h, k]: mat4) =>
	a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g)

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
	keeps: () => true,
	transforms: (options) => [placeOnGround(options)]
}
