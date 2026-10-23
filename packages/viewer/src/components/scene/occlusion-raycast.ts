import { BufferGeometry, Mesh, Matrix4, Ray, Vector3 } from 'three'
import { MeshBVH } from 'three-mesh-bvh'

import type {
	BufferAttribute,
	InterleavedBufferAttribute,
	Intersection,
	Object3D,
	Raycaster
} from 'three'

/**
 * A geometry's bounds tree, and the attributes it was built from.
 *
 * Both the attribute objects and their versions, because a host can change a
 * geometry either way: replace an attribute with `setAttribute`, or edit it in
 * place and flag `needsUpdate`. Either one leaves a tree describing triangles
 * that are no longer there.
 */
interface CachedTree {
	tree: MeshBVH
	position: BufferAttribute | InterleavedBufferAttribute
	positionVersion: number
	index: BufferAttribute | null
	indexVersion: number
}

/**
 * Keyed on the geometry rather than held by a component, so the trees go when
 * the geometry does and nothing has to remember to dispose of them. Nothing is
 * written onto the host's geometry either: this package renders models it was
 * handed, and a `boundsTree` property appearing on them would change how the
 * host's own raycasts behave if the host happens to use three-mesh-bvh too.
 */
const trees = new WeakMap<BufferGeometry, CachedTree>()

const versionOf = (attribute: BufferAttribute | InterleavedBufferAttribute) =>
	'isInterleavedBufferAttribute' in attribute &&
	attribute.isInterleavedBufferAttribute
		? attribute.data.version
		: (attribute as BufferAttribute).version

function treeFor(geometry: BufferGeometry): MeshBVH {
	const position = geometry.attributes.position
	const index = geometry.index
	const cached = trees.get(geometry)
	if (
		cached &&
		cached.position === position &&
		cached.positionVersion === versionOf(position) &&
		cached.index === index &&
		cached.indexVersion === (index?.version ?? -1)
	) {
		return cached.tree
	}

	/*
	  Built over a geometry of our own that shares the positions, because a
	  tree sorts the index it is built from and gives an unindexed geometry one,
	  and the host's geometry has to come out of this as it went in.

	  Without the host's groups, on purpose: only single-material meshes reach
	  a tree (see `isAccelerable`), and for those three tests every triangle in
	  the draw range whatever the groups say, so a tree built per group would
	  skip the triangles no group covers.
	*/
	const source = new BufferGeometry()
	source.setAttribute('position', position)
	if (index) source.setIndex(index.clone())
	const tree = new MeshBVH(source)
	trees.set(geometry, {
		tree,
		position,
		positionVersion: versionOf(position),
		index,
		indexVersion: index?.version ?? -1
	})
	return tree
}

/**
 * Whether a tree answers for this mesh exactly as `Mesh.raycast` would.
 *
 * Everything else falls through to three's own raycast. Only meshes still on
 * `Mesh.prototype.raycast` qualify, which keeps out skinned, instanced and
 * batched meshes - each brings a raycast of its own, because a tree over the
 * stored geometry cannot see skinning or a geometry drawn many times - and a
 * mesh whose `raycast` the host replaced: R3F's `raycast={() => null}` is the
 * usual way to make something unpickable, and it has to keep meaning the same
 * thing here. Morph targets and a draw range change the drawn triangles without
 * changing the stored ones, so they fall through too.
 *
 * So does a material array. three tests each group with its own material, and
 * three-mesh-bvh 0.8 pairs materials with its roots by position rather than by
 * group, which goes wrong for groups that leave gaps, overlap, are out of
 * order or run to `Infinity`. glTF never produces an array - each primitive is
 * a mesh of its own - so this costs the formats that do, FBX and OBJ, only the
 * speed they had before.
 */
function isAccelerable(object: Object3D): object is Mesh<BufferGeometry> {
	const mesh = object as Mesh<BufferGeometry>
	if (!mesh.isMesh || mesh.raycast !== Mesh.prototype.raycast) return false
	if (mesh.material === undefined || Array.isArray(mesh.material)) return false

	const geometry = mesh.geometry
	if (!geometry?.attributes.position) return false
	if (geometry.morphAttributes.position) return false
	return geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity
}

const inverse = new Matrix4()
const localRay = new Ray()
const worldPoint = new Vector3()
const hits: Intersection[] = []

/**
 * The nearest hit on one mesh, tested against `raycaster.far` in world space.
 *
 * The nearest hit along the ray in the mesh's own space is the nearest in world
 * space too, because the matrix maps the ray to a line and keeps the order of
 * points on it. So the distance is measured on that one point after mapping it
 * back, which is exact under any matrix, shear included, where scaling the
 * bounds into local space would only be exact for translate-rotate-scale.
 */
function hitsMesh(mesh: Mesh<BufferGeometry>, raycaster: Raycaster): boolean {
	inverse.copy(mesh.matrixWorld).invert()
	localRay.copy(raycaster.ray).applyMatrix4(inverse)

	const hit = treeFor(mesh.geometry).raycastFirst(localRay, mesh.material)
	if (!hit) return false

	worldPoint.copy(hit.point).applyMatrix4(mesh.matrixWorld)
	return raycaster.ray.origin.distanceTo(worldPoint) <= raycaster.far
}

/**
 * Whether anything in `root` lies on the raycaster's ray before `far`.
 *
 * The same answer as `raycaster.intersectObject(root, true).length > 0`, for a
 * raycaster whose `near` is 0, at a fraction of the cost. Plain meshes are
 * tested against a bounds tree built once per geometry, rather than every
 * triangle on every call. And the walk stops at the first hit, because the
 * question is whether anything is there, not what is nearest.
 *
 * One deliberate difference: three culls a mesh on the bounds cached on its
 * geometry, which go stale if a host edits positions without recomputing them.
 * A tree is rebuilt from the edited positions, so here the moved triangles
 * still occlude.
 *
 * The walk itself follows `Raycaster.intersectObject`: layers are tested per
 * object, invisible objects still count, and an object whose `raycast` returns
 * `false` keeps its children out.
 */
export function isRayBlocked(root: Object3D, raycaster: Raycaster): boolean {
	const pending: Object3D[] = [root]

	while (pending.length > 0) {
		const object = pending.pop() as Object3D
		let descend = true

		if (object.layers.test(raycaster.layers)) {
			if (isAccelerable(object)) {
				if (hitsMesh(object, raycaster)) return true
			} else {
				hits.length = 0
				// Typed as void, but three's own walk reads `false` from it.
				const result = object.raycast(raycaster, hits) as unknown
				if (hits.length > 0) {
					hits.length = 0
					return true
				}
				if (result === false) descend = false
			}
		}

		if (descend) pending.push(...object.children)
	}

	return false
}
