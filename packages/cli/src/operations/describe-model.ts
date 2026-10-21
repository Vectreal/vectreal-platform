import { resolveNormalizedScale } from '@vctrl/core'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'

import type { Accessor, Document, Node, Primitive } from '@gltf-transform/core'
import type { NormalizationOptions } from '@vctrl/core'

/** An accessor's bounds, dequantized as GLTFLoader reads them. */
const accessorBox = (accessor: Accessor) =>
	new Box3(
		new Vector3().fromArray(accessor.getMinNormalized([])),
		new Vector3().fromArray(accessor.getMaxNormalized([]))
	)

/**
 * A primitive's geometry box as GLTFLoader builds it, which is what the
 * viewer's normalization measures: its POSITION bounds, widened by how far any
 * morph target can move a vertex.
 */
function loaderBox(primitive: Primitive) {
	const position = primitive.getAttribute('POSITION')
	if (!position) return null
	const box = accessorBox(position)
	const displacement = new Vector3()
	for (const target of primitive.listTargets()) {
		const moved = target.getAttribute('POSITION')
		if (!moved) continue
		const { min, max } = accessorBox(moved)
		displacement.max(
			new Vector3(
				Math.max(Math.abs(min.x), Math.abs(max.x)),
				Math.max(Math.abs(min.y), Math.abs(max.y)),
				Math.max(Math.abs(min.z), Math.abs(max.z))
			)
		)
	}
	box.min.sub(displacement)
	box.max.add(displacement)
	return box
}

/** glTF's triangle modes; three draws the others as Points or Lines. */
const TRIANGLE_MODES = new Set([4, 5, 6])

/**
 * Every vertex of a primitive, in world space, added to `box`, moved by the
 * morph weights it opens with: GLTFLoader sets them as the mesh's influences,
 * and a precise Box3 measures the vertices they move. Points and Lines are
 * measured unmorphed, as Box3 measures them. When any target moves POSITION,
 * GLTFLoader gives a target that does not the base position as its offset.
 */
function expandByVertices(
	box: Box3,
	primitive: Primitive,
	world: Matrix4,
	weights: number[]
) {
	const position = primitive.getAttribute('POSITION')
	if (!position) return
	const morphs = primitive.listTargets()
	const morphsPosition = morphs.some((target) =>
		target.getAttribute('POSITION')
	)
	const targets =
		TRIANGLE_MODES.has(primitive.getMode()) && morphsPosition
			? morphs
					.map((target, index) => ({
						moved: target.getAttribute('POSITION') ?? position,
						weight: weights[index] ?? 0
					}))
					.filter(({ weight }) => weight !== 0)
			: []
	const element: number[] = []
	const vertex = new Vector3()
	const offset = new Vector3()
	for (let index = 0; index < position.getCount(); index++) {
		vertex.fromArray(position.getElement(index, element))
		for (const { moved, weight } of targets) {
			vertex.addScaledVector(
				offset.fromArray(moved.getElement(index, element)),
				weight
			)
		}
		box.expandByPoint(vertex.applyMatrix4(world))
	}
}

/**
 * The instance transforms of an `EXT_mesh_gpu_instancing` node, or null when
 * the viewer draws it uninstanced: GLTFLoader instances only triangle meshes.
 * Read through the extension's attributes rather than its class, which the
 * CLI does not depend on. The count comes from any attribute, a transform
 * left out is identity, as GLTFLoader reads them.
 */
function instanceMatrices(
	node: Node,
	primitives: Primitive[]
): Matrix4[] | null {
	const instancing = node.getExtension(
		'EXT_mesh_gpu_instancing'
	) as unknown as {
		getAttribute(semantic: string): Accessor | null
		listAttributes(): Accessor[]
	} | null
	if (
		!instancing ||
		!primitives.every((primitive) => TRIANGLE_MODES.has(primitive.getMode()))
	) {
		return null
	}
	const translation = instancing.getAttribute('TRANSLATION')
	const rotation = instancing.getAttribute('ROTATION')
	const scale = instancing.getAttribute('SCALE')
	const count = instancing.listAttributes()[0]?.getCount() ?? 0
	const element: number[] = []
	return Array.from({ length: count }, (_, index) =>
		new Matrix4().compose(
			new Vector3().fromArray(
				translation?.getElement(index, element) ?? [0, 0, 0]
			),
			new Quaternion().fromArray(
				rotation?.getElement(index, element) ?? [0, 0, 0, 1]
			),
			new Vector3().fromArray(scale?.getElement(index, element) ?? [1, 1, 1])
		)
	)
}

const round = (value: number) => Math.round(value * 1e4) / 1e4
const vector = (v: Vector3) => [round(v.x), round(v.y), round(v.z)]
const describeBox = (box: Box3) => ({
	min: vector(box.min),
	max: vector(box.max),
	size: vector(box.getSize(new Vector3())),
	center: vector(box.getCenter(new Vector3()))
})

/**
 * A model's size, parts, materials and clips, and where the viewer puts it.
 *
 * The viewer measures twice, and so does this. Its normalization scale is
 * `resolveNormalizedScale` of the diagonal of the box Box3 takes by default:
 * each geometry's box, as GLTFLoader builds it, through the node's world
 * matrix. Its placement is drei's `<Center top>`, which measures the scaled
 * model's exact vertices and moves it to rest on y = 0, centered on x and z.
 * Hotspots and cameras live in that space, so `viewer` is the space to place
 * them in; every box reported is exact.
 */
export function describeDocument(
	document: Document,
	normalization: NormalizationOptions | undefined
) {
	const root = document.getRoot()
	const scene = root.getDefaultScene() ?? root.listScenes()[0]
	const materials = root.listMaterials()
	const materialName = (material: (typeof materials)[number]) =>
		material.getName() || `material ${materials.indexOf(material)}`

	const loaderBounds = new Box3()
	const bounds = new Box3()
	const parts: { name: string; materials: string[]; box: Box3 }[] = []
	let skinned = false as boolean
	scene?.traverse((node) => {
		const mesh = node.getMesh()
		if (!mesh) return
		skinned ||= node.getSkin() !== null
		const world = new Matrix4().fromArray(node.getWorldMatrix())
		const instances = instanceMatrices(node, mesh.listPrimitives())
		// The node's weights over the mesh's, one index at a time, as GLTFLoader.
		const weights =
			mesh
				.listPrimitives()[0]
				?.listTargets()
				.map(
					(_, index) =>
						node.getWeights()[index] ?? mesh.getWeights()[index] ?? 0
				) ?? []
		const box = new Box3()
		for (const primitive of mesh.listPrimitives()) {
			const loader = loaderBox(primitive)
			if (!loader) continue
			if (instances) {
				// Box3 measures an InstancedMesh by its bounding box either way: the
				// geometry's box through each instance, then the world matrix.
				const all = new Box3()
				for (const instance of instances) {
					all.union(loader.clone().applyMatrix4(instance))
				}
				all.applyMatrix4(world)
				loaderBounds.union(all)
				box.union(all)
			} else {
				loaderBounds.union(loader.applyMatrix4(world))
				expandByVertices(box, primitive, world, weights)
			}
		}
		if (box.isEmpty()) return
		bounds.union(box)
		parts.push({
			name:
				node.getName() ||
				mesh.getName() ||
				`mesh ${root.listMeshes().indexOf(mesh)}`,
			materials: [
				...new Set(
					mesh
						.listPrimitives()
						.flatMap((primitive) => primitive.getMaterial() ?? [])
						.map(materialName)
				)
			],
			box
		})
	})

	const scale = resolveNormalizedScale(
		loaderBounds.getSize(new Vector3()).length(),
		normalization
	)
	const center = bounds.getCenter(new Vector3())
	const toViewer = new Matrix4()
		.makeScale(scale, scale, scale)
		.premultiply(
			new Matrix4().makeTranslation(
				-center.x * scale,
				-bounds.min.y * scale,
				-center.z * scale
			)
		)
	const inViewer = (box: Box3) => box.clone().applyMatrix4(toViewer)

	return {
		bounds: bounds.isEmpty() ? null : describeBox(bounds),
		viewer: bounds.isEmpty()
			? null
			: {
					scale: round(scale),
					normalization: normalization?.enabled === true,
					bounds: describeBox(inViewer(bounds))
				},
		meshes: parts.map(({ name, materials, box }) => {
			const { center, size } = describeBox(inViewer(box))
			return { name, materials, center, size }
		}),
		materials: materials.map((material) => ({
			name: materialName(material),
			baseColor: material.getBaseColorFactor(),
			metallic: material.getMetallicFactor(),
			roughness: material.getRoughnessFactor(),
			alphaMode: material.getAlphaMode(),
			doubleSided: material.getDoubleSided(),
			textures: Object.entries({
				baseColor: material.getBaseColorTexture(),
				metallicRoughness: material.getMetallicRoughnessTexture(),
				normal: material.getNormalTexture(),
				occlusion: material.getOcclusionTexture(),
				emissive: material.getEmissiveTexture()
			}).flatMap(([slot, texture]) => (texture ? [slot] : []))
		})),
		animations: root.listAnimations().map((animation, index) => ({
			name: animation.getName() || `animation ${index}`,
			duration: round(
				Math.max(
					0,
					...animation
						.listSamplers()
						.map((sampler) => sampler.getInput()?.getMax([])[0] ?? 0)
				)
			),
			channels: animation.listChannels().length
		})),
		...(skinned
			? {
					note: 'Skinned meshes are measured unskinned, at their bind pose; the viewer may frame them slightly differently.'
				}
			: {})
	}
}
