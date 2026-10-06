import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
	Box3,
	BoxGeometry,
	Group,
	Mesh,
	MeshBasicMaterial,
	Vector3
} from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { measureModel, worldBounds } from './model-measurement'

/** A 2 × 4 × 6 box, offset inside its model the way a glTF scene often is. */
const model = () => {
	const root = new Group()
	const mesh = new Mesh(new BoxGeometry(2, 4, 6), new MeshBasicMaterial())
	mesh.position.set(1, 0, 0)
	root.add(mesh)
	return root
}

/** Mounts `object` the way the viewer does: `Center`'s offset, then the normalization scale. */
const mountUnder = (object: Group, scale: number) => {
	const center = new Group()
	center.position.set(5, -2, 3)
	const normalization = new Group()
	normalization.scale.setScalar(scale)
	center.add(normalization)
	normalization.add(object)
	return { center, normalization }
}

const size = (box: Box3) => box.getSize(new Vector3())

afterEach(() => {
	vi.restoreAllMocks()
})

describe('measureModel', () => {
	it('walks a model once, however many consumers ask', () => {
		const walk = vi.spyOn(Box3.prototype, 'setFromObject')
		const subject = model()

		measureModel(subject)
		measureModel(subject)
		worldBounds(subject)

		expect(walk).toHaveBeenCalledOnce()
	})

	it('measures the model without its ancestors, mounted or not', () => {
		const loose = measureModel(model())
		const mounted = model()
		mountUnder(mounted, 3)

		expect(size(measureModel(mounted).bounds)).toEqual(size(loose.bounds))
		expect(size(loose.bounds)).toEqual(new Vector3(2, 4, 6))
		expect(loose.bounds.min.x).toBeCloseTo(0)
	})

	it('counts the vertices the bake signature fingerprints', () => {
		expect(measureModel(model()).vertexCount).toBe(
			new BoxGeometry(2, 4, 6).attributes.position.count
		)
	})
})

describe('worldBounds', () => {
	it('is the box a full walk of the mounted model would measure', () => {
		const subject = model()
		mountUnder(subject, 2.5)

		subject.updateWorldMatrix(true, true)
		const expected = new Box3().setFromObject(subject)
		const actual = worldBounds(subject)

		for (const corner of ['min', 'max'] as const) {
			for (const axis of ['x', 'y', 'z'] as const) {
				expect(actual[corner][axis]).toBeCloseTo(expected[corner][axis], 9)
			}
		}
	})

	it('follows a new normalization scale without walking the geometry again', () => {
		const subject = model()
		const { normalization } = mountUnder(subject, 1)
		measureModel(subject)
		const walk = vi.spyOn(Box3.prototype, 'setFromObject')

		normalization.scale.setScalar(4)

		expect(size(worldBounds(subject))).toEqual(new Vector3(8, 16, 24))
		expect(walk).not.toHaveBeenCalled()
	})

	it('stays empty for a model with nothing to measure', () => {
		const empty = new Group()
		mountUnder(empty, 3)

		expect(worldBounds(empty).isEmpty()).toBe(true)
	})
})

describe('the viewer', () => {
	const sources = (directory: string): string[] =>
		readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
			const path = join(directory, entry.name)
			if (entry.isDirectory()) return sources(path)
			return /\.tsx?$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name)
				? [path]
				: []
		})
	const viewerSrc = join(import.meta.dirname, '..', '..')

	it('walks a model only in the shared measurement and the screenshot fit', () => {
		const walkers = sources(viewerSrc)
			.filter((path) => readFileSync(path, 'utf8').includes('.setFromObject('))
			.map((path) => path.slice(viewerSrc.length + 1))
			.sort()

		expect(walkers).toEqual([
			'components/scene/model-measurement.ts',
			'components/scene/scene-model.tsx'
		])
	})
})
