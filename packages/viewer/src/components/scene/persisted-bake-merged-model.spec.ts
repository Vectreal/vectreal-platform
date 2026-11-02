/**
 * Merging meshes in the optimizer moves every part's transform into its
 * vertices, so the model a viewer loads afterwards measures to its exact box
 * rather than the looser one its rotated parts gave. A stored ground bake
 * carries the basis it was captured on, so that change must not cost it.
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { describe, expect, it } from 'vitest'

import { measureModel } from './model-measurement'
import {
	computeBakeSignature,
	isPersistedBakeValid,
	type BakeSignatureOptions
} from './shadow-bake'

const options: BakeSignatureOptions = {
	lights: [{ azimuth: 30, elevation: 50, size: 20, intensity: 1 }],
	rotation: 0,
	frames: 48,
	scale: 4,
	resolution: 1024
}

/**
 * Two round parts, each turned an eighth of a turn, as an import from CAD
 * often has them. A turned part's own box, carried through its turn, is
 * larger than its vertices; once merged, the box is the vertices' own.
 */
function parts() {
	const model = new Group()
	for (const x of [-1, 1]) {
		const part = new Mesh(new SphereGeometry(0.5, 16, 8))
		part.position.set(x, 0.5, 0)
		part.rotation.y = Math.PI / 4
		model.add(part)
	}
	return model
}

/** The same parts merged: their transforms written into one geometry. */
function merged() {
	const source = parts()
	source.updateMatrixWorld(true)
	const geometries = source.children.map((child) =>
		(child as Mesh).geometry.clone().applyMatrix4(child.matrixWorld)
	)
	const model = new Group()
	model.add(new Mesh(mergeGeometries(geometries)))
	return model
}

/** What SceneShadows derives from a measurement. */
function basisOf(model: Group) {
	const { bounds, vertexCount } = measureModel(model)
	const size = bounds.getSize(new Vector3())
	return {
		footprint: Math.max(size.x, size.z),
		radius: 0.5 * Math.hypot(size.x, size.y, size.z),
		vertexCount
	}
}

describe('a stored ground bake across mesh merging', () => {
	const before = basisOf(parts())
	const after = basisOf(merged())
	const baked = {
		signature: computeBakeSignature(
			options,
			before.footprint,
			before.radius,
			before.vertexCount
		),
		basis: before
	}

	it('measures the merged model tighter, as the viewer will', () => {
		expect(after.vertexCount).toBe(before.vertexCount)
		expect(after.footprint).toBeLessThan(before.footprint)
	})

	it('keeps the bake valid on the merged model', () => {
		expect(
			isPersistedBakeValid(baked, options, { ...after, measured: true })
		).toBe(true)
	})
})
