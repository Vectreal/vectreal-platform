import {
	Primitive,
	type Document,
	type Material,
	type Mesh,
	type Node
} from '@gltf-transform/core'

/** One triangle primitive as the scene places it. */
export interface ScenePrimitive {
	node: Node
	mesh: Mesh
	primitive: Primitive
	material: Material | null
	/** Column-major, as glTF stores it. */
	worldMatrix: number[]
}

/*
  The scene a viewer opens is the default scene, or the first one when the file
  names none. Points and lines neither receive nor cast occlusion, so only
  triangles are listed.
*/
export function listScenePrimitives(document: Document): ScenePrimitive[] {
	const root = document.getRoot()
	const scene = root.getDefaultScene() ?? root.listScenes()[0]
	if (!scene) return []

	const primitives: ScenePrimitive[] = []
	scene.traverse((node) => {
		const mesh = node.getMesh()
		if (!mesh) return
		const worldMatrix = Array.from(node.getWorldMatrix())
		for (const primitive of mesh.listPrimitives()) {
			if (primitive.getMode() !== Primitive.Mode['TRIANGLES']) continue
			primitives.push({
				node,
				mesh,
				primitive,
				material: primitive.getMaterial(),
				worldMatrix
			})
		}
	})
	return primitives
}

/** The primitive's triangles as vertex indices, whether or not it is indexed. */
export function triangleIndices(primitive: Primitive): ArrayLike<number> {
	const indices = primitive.getIndices()?.getArray()
	if (indices) return indices
	const count = primitive.getAttribute('POSITION')?.getCount() ?? 0
	return Array.from({ length: count }, (_, i) => i)
}
