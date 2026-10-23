import {
	BackSide,
	Bone,
	BoxGeometry,
	BufferGeometry,
	DoubleSide,
	Float32BufferAttribute,
	Group,
	InstancedMesh,
	InterleavedBuffer,
	InterleavedBufferAttribute,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	Raycaster,
	Skeleton,
	SkinnedMesh,
	SphereGeometry,
	TorusKnotGeometry,
	Uint16BufferAttribute,
	Vector3
} from 'three'
import { describe, expect, it } from 'vitest'

import { isRayBlocked } from './occlusion-raycast'

import type { Object3D } from 'three'

const material = () => new MeshBasicMaterial()

/** A deterministic stream in [0, 1), so a failure reproduces. */
const random = (seed: number) => () => {
	seed = (seed * 16807) % 2147483647
	return (seed - 1) / 2147483646
}

/**
 * A model built from every shape `isRayBlocked` treats differently: plain
 * meshes under rotated, non-uniformly scaled and therefore sheared parents,
 * one-sided and two-sided materials, grouped multi-material geometry, an
 * unindexed geometry, quantized interleaved positions the way a compressed
 * glTF stores them, an invisible mesh, and one on a layer the ray ignores.
 */
const model = (): Group => {
	const root = new Group()
	root.rotation.set(0.3, 0.5, 0.1)
	root.scale.set(1.5, 0.7, 1.1)

	const knot = new Mesh(new TorusKnotGeometry(0.6, 0.18, 64, 8), material())
	knot.position.set(0.4, 0.2, 0)
	// Rotated under a non-uniform scale: the child's world matrix shears.
	knot.rotation.set(0.7, 0, 0.4)
	root.add(knot)

	const back = new Mesh(new SphereGeometry(0.4, 12, 8), material())
	;(back.material as MeshBasicMaterial).side = BackSide
	back.position.set(-1, 0.5, 0.3)
	root.add(back)

	const plane = new Mesh(
		new PlaneGeometry(1.2, 0.8),
		new MeshBasicMaterial({ side: DoubleSide })
	)
	plane.position.set(0, -0.8, 0.6)
	plane.rotation.set(0.4, 1.1, 0)
	root.add(plane)

	const grouped = new Mesh(new BoxGeometry(0.5, 0.5, 0.5), [
		material(),
		new MeshBasicMaterial({ side: BackSide }),
		material(),
		material(),
		new MeshBasicMaterial({ side: DoubleSide }),
		material()
	])
	grouped.position.set(1, -0.4, -0.6)
	root.add(grouped)

	const unindexed = new Mesh(
		new SphereGeometry(0.3, 10, 6).toNonIndexed(),
		material()
	)
	unindexed.position.set(-0.6, -0.5, -0.7)
	root.add(unindexed)

	root.add(quantizedTriangleMesh())

	// One material and groups covering half the triangles: three ignores them.
	const partlyGrouped = new Mesh(new SphereGeometry(0.35, 10, 6), material())
	partlyGrouped.geometry.addGroup(0, 90, 0)
	partlyGrouped.position.set(0.8, 0.9, -0.2)
	root.add(partlyGrouped)

	const hidden = new Mesh(new BoxGeometry(0.4, 0.4, 0.4), material())
	hidden.visible = false
	hidden.position.set(-1.2, -0.9, 0.9)
	root.add(hidden)

	const otherLayer = new Mesh(new BoxGeometry(0.6, 0.6, 0.6), material())
	otherLayer.layers.set(3)
	otherLayer.position.set(1.1, 0.9, 0.9)
	root.add(otherLayer)

	root.updateMatrixWorld(true)
	return root
}

/** Normalized int16 positions in an interleaved buffer, as glTF quantizes them. */
function quantizedTriangleMesh(): Mesh {
	const geometry = new BufferGeometry()
	const scale = 32767
	const data = new Int16Array([
		-scale,
		-scale,
		0,
		0,
		scale,
		-scale,
		0,
		0,
		0,
		scale,
		0,
		0
	])
	geometry.setAttribute(
		'position',
		new InterleavedBufferAttribute(new InterleavedBuffer(data, 4), 3, 0, true)
	)
	const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }))
	mesh.position.set(0, 1, -0.8)
	mesh.scale.setScalar(0.6)
	return mesh
}

/** What the occlusion pass asked before: any hit at all, by brute force. */
const bruteForce = (root: Object3D, raycaster: Raycaster) =>
	raycaster.intersectObject(root, true).length > 0

const aim = (
	raycaster: Raycaster,
	origin: Vector3,
	target: Vector3,
	farRatio = 1
) => {
	const direction = target.clone().sub(origin)
	raycaster.set(origin, direction.clone().normalize())
	raycaster.near = 0
	raycaster.far = direction.length() * farRatio
}

describe('isRayBlocked', () => {
	it('agrees with a brute-force raycast on every ray', () => {
		const root = model()
		const raycaster = new Raycaster()
		const next = random(7)
		let blocked = 0
		let clear = 0

		for (let i = 0; i < 2000; i++) {
			const origin = new Vector3(
				next() - 0.5,
				next() - 0.5,
				next() - 0.5
			).setLength(3 + next() * 3)
			const target = new Vector3(
				next() * 3 - 1.5,
				next() * 3 - 1.5,
				next() * 3 - 1.5
			)
			// Short of, at, and past the target, so `far` decides some rays.
			aim(raycaster, origin, target, 0.5 + next())

			const expected = bruteForce(root, raycaster)
			expect(isRayBlocked(root, raycaster), `ray ${i}`).toBe(expected)
			if (expected) blocked += 1
			else clear += 1
		}

		// Both answers have to be common, or agreement proves little.
		expect(blocked).toBeGreaterThan(300)
		expect(clear).toBeGreaterThan(300)
	})

	it('tests every triangle of a single-material mesh, whatever its groups say', () => {
		// three ignores groups unless the material is an array, so a triangle no
		// group covers still occludes.
		const geometry = new PlaneGeometry(2, 1, 2, 1).translate(0.5, 0, 0)
		geometry.addGroup(6, 6, 0)
		const mesh = new Mesh(geometry, material())
		const raycaster = new Raycaster()
		aim(raycaster, new Vector3(0, 0, 2), new Vector3(0, 0, -2))

		expect(bruteForce(mesh, raycaster)).toBe(true)
		expect(isRayBlocked(mesh, raycaster)).toBe(true)
	})

	/*
	  Both start with the geometry off to the side and move it onto the ray, and
	  both subdivide it: a tree small enough to be a single leaf tests its
	  triangles without consulting its bounds, so it would find the moved ones
	  anyway. A larger tree left over from before the move still bounds the old
	  place, so it misses the triangles now in the way - the stale answer is "clear", which
	  is the one that would leave a marker drawn over the geometry hiding it.
	*/
	it('rebuilds once a geometry is edited in place', () => {
		const mesh = new Mesh(
			new PlaneGeometry(1, 1, 16, 16).translate(5, 0, 0),
			material()
		)
		const raycaster = new Raycaster()
		aim(raycaster, new Vector3(0, 0, 2), new Vector3(0, 0, -2))
		expect(isRayBlocked(mesh, raycaster)).toBe(false)

		mesh.geometry.translate(-5, 0, 0)
		expect(bruteForce(mesh, raycaster)).toBe(true)
		expect(isRayBlocked(mesh, raycaster)).toBe(true)
	})

	it('rebuilds once a geometry is given new positions', () => {
		const mesh = new Mesh(
			new PlaneGeometry(1, 1, 16, 16).translate(5, 0, 0),
			material()
		)
		const raycaster = new Raycaster()
		aim(raycaster, new Vector3(0, 0, 2), new Vector3(0, 0, -2))
		expect(isRayBlocked(mesh, raycaster)).toBe(false)

		const moved = new PlaneGeometry(1, 1, 16, 16)
		mesh.geometry.setAttribute('position', moved.attributes.position)
		expect(bruteForce(mesh, raycaster)).toBe(true)
		expect(isRayBlocked(mesh, raycaster)).toBe(true)
	})

	it('leaves the geometry it was given as it found it', () => {
		// Large enough that building a tree reorders its triangles.
		const indexed = new TorusKnotGeometry(0.5, 0.15, 64, 8)
		const order = Array.from(indexed.index?.array ?? [])
		const unindexed = new SphereGeometry(0.5, 8, 6).toNonIndexed()
		const raycaster = new Raycaster()
		aim(raycaster, new Vector3(0, 0, 2), new Vector3(0, 0, -2))

		// One at a time: in a group the walk would stop at the first hit and
		// never build the other's tree. Each tree is built whatever the answer.
		isRayBlocked(new Mesh(indexed, material()), raycaster)
		isRayBlocked(new Mesh(unindexed, material()), raycaster)
		expect(Array.from(indexed.index?.array ?? [])).toEqual(order)
		expect(unindexed.index).toBeNull()
		expect(indexed.boundingBox).toBeNull()
		expect('boundsTree' in indexed).toBe(false)
	})

	it('stops descending where an object says to', () => {
		const parent = new Group()
		parent.raycast = (() => false) as unknown as typeof parent.raycast
		parent.add(new Mesh(new PlaneGeometry(1, 1), material()))
		const raycaster = new Raycaster()
		aim(raycaster, new Vector3(0, 0, 2), new Vector3(0, 0, -2))

		expect(bruteForce(parent, raycaster)).toBe(false)
		expect(isRayBlocked(parent, raycaster)).toBe(false)
	})

	/*
	  Each of these is a mesh a bounds tree over its stored geometry would get
	  wrong. The ray is aimed where the stored triangles are and the drawn ones
	  are not, so a tree that wrongly took the mesh over would report a hit.
	*/
	describe('falls back to three for meshes a tree cannot describe', () => {
		const raycaster = new Raycaster()
		const throughOrigin = () =>
			aim(raycaster, new Vector3(0, 0, 2), new Vector3(0, 0, -2))

		it('a mesh that opted out of raycasting', () => {
			const mesh = new Mesh(new PlaneGeometry(1, 1), material())
			mesh.raycast = () => {}
			throughOrigin()
			expect(isRayBlocked(mesh, raycaster)).toBe(false)
		})

		it('a skinned mesh posed away from its bind pose', () => {
			const geometry = new PlaneGeometry(1, 1)
			const count = geometry.attributes.position.count
			geometry.setAttribute(
				'skinIndex',
				new Uint16BufferAttribute(new Uint16Array(count * 4), 4)
			)
			geometry.setAttribute(
				'skinWeight',
				new Float32BufferAttribute(
					Array.from({ length: count }, () => [1, 0, 0, 0]).flat(),
					4
				)
			)
			const bone = new Bone()
			const mesh = new SkinnedMesh(geometry, material())
			mesh.add(bone)
			mesh.bind(new Skeleton([bone]))
			bone.position.set(5, 0, 0)
			mesh.updateMatrixWorld(true)
			mesh.skeleton.update()

			throughOrigin()
			expect(bruteForce(mesh, raycaster)).toBe(false)
			expect(isRayBlocked(mesh, raycaster)).toBe(false)
		})

		it('a morphed mesh', () => {
			const geometry = new PlaneGeometry(1, 1)
			geometry.morphAttributes.position = [
				new PlaneGeometry(1, 1, 16, 16).translate(5, 0, 0).attributes.position
			]
			const mesh = new Mesh(geometry, material())
			mesh.updateMorphTargets()
			mesh.morphTargetInfluences = [1]

			throughOrigin()
			expect(bruteForce(mesh, raycaster)).toBe(false)
			expect(isRayBlocked(mesh, raycaster)).toBe(false)
		})

		it('an instanced mesh', () => {
			const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material(), 1)
			mesh.setMatrixAt(0, new Matrix4().makeTranslation(5, 0, 0))
			mesh.updateMatrixWorld(true)

			throughOrigin()
			expect(bruteForce(mesh, raycaster)).toBe(false)
			expect(isRayBlocked(mesh, raycaster)).toBe(false)
		})

		it('a mesh drawing part of its geometry', () => {
			// Two quads side by side; only the second is drawn.
			const geometry = new PlaneGeometry(2, 1, 2, 1).translate(0.5, 0, 0)
			geometry.setDrawRange(6, 6)
			const mesh = new Mesh(geometry, material())

			throughOrigin()
			expect(bruteForce(mesh, raycaster)).toBe(false)
			expect(isRayBlocked(mesh, raycaster)).toBe(false)
		})

		/*
		  three tests each group with its own material. These are the group
		  layouts three-mesh-bvh 0.8 maps to the wrong material, throws on, or
		  never finishes building for.
		*/
		it.each([
			['no groups', []],
			[
				'groups with a gap',
				[
					[0, 3, 0],
					[6, 3, 1]
				]
			],
			[
				'overlapping groups',
				[
					[0, 6, 0],
					[3, 6, 1]
				]
			],
			[
				'groups out of order',
				[
					[3, 9, 1],
					[0, 3, 0]
				]
			],
			['a group running to Infinity', [[0, Infinity, 0]]]
		])('a material array with %s', (_label, groups) => {
			// Four triangles left to right; the second material is back-side only.
			const geometry = new PlaneGeometry(2, 1, 2, 1)
			for (const [start, count, index] of groups) {
				geometry.addGroup(start, count, index)
			}
			const mesh = new Mesh(geometry, [
				material(),
				new MeshBasicMaterial({ side: BackSide })
			])

			for (const x of [-0.75, -0.25, 0.25, 0.75]) {
				for (const z of [2, -2]) {
					aim(raycaster, new Vector3(x, 0.1, z), new Vector3(x, 0.1, -z))
					expect(isRayBlocked(mesh, raycaster), `x ${x}, z ${z}`).toBe(
						bruteForce(mesh, raycaster)
					)
				}
			}
		})
	})
})
