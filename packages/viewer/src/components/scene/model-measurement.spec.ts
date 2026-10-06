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

	it('keeps each model to its own measurement', () => {
		const walk = vi.spyOn(Box3.prototype, 'setFromObject')
		const large = model()
		const small = new Group().add(
			new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial())
		)

		expect(size(measureModel(large).bounds)).toEqual(new Vector3(2, 4, 6))
		expect(size(measureModel(small).bounds)).toEqual(new Vector3(1, 1, 1))
		expect(walk).toHaveBeenCalledTimes(2)
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

	it('ignores a rotated parent the model was first measured under', () => {
		const subject = model()
		const host = new Group()
		host.rotation.set(0.7, 0.4, 1.1)
		host.scale.setScalar(5)
		host.add(subject)

		const { bounds } = measureModel(subject)

		expect(size(bounds).x).toBeCloseTo(2, 9)
		expect(size(bounds).y).toBeCloseTo(4, 9)
		expect(size(bounds).z).toBeCloseTo(6, 9)
		expect(subject.parent).toBe(host)
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

	const read = (path: string) => readFileSync(join(viewerSrc, path), 'utf8')
	const occurrences = (source: string, needle: string) =>
		source.split(needle).length - 1

	it('walks a model only in the shared measurement, the screenshot fit and the live hotspot pose', () => {
		const walks = Object.fromEntries(
			sources(viewerSrc)
				.map((path) => [
					path.slice(viewerSrc.length + 1),
					occurrences(readFileSync(path, 'utf8'), '.setFromObject(')
				])
				.filter(([, count]) => count)
		)

		expect(walks).toEqual({
			'components/scene/model-measurement.ts': 1,
			'components/scene/scene-hotspots.tsx': 1,
			'components/scene/scene-model.tsx': 1
		})

		const sceneModel = read('components/scene/scene-model.tsx')
		const screenshotFit = sceneModel.slice(
			sceneModel.indexOf('function solveAutoFitFraming('),
			sceneModel.indexOf(
				'\n}\n',
				sceneModel.indexOf('function solveAutoFitFraming(')
			)
		)
		expect(screenshotFit).toContain('.setFromObject(')
	})

	it('reads world bounds wherever the normalization scale matters', () => {
		for (const [path, call] of [
			['components/scene/scene-shadows.tsx', 'worldBounds(model)'],
			['components/scene/scene-postprocessing.tsx', 'worldBounds(model)'],
			[
				'components/scene/scene-model.tsx',
				'worldBounds(object).getBoundingSphere'
			]
		]) {
			expect(read(path), path).toContain(call)
		}

		const rawReaders = sources(viewerSrc)
			.filter((path) =>
				/measureModel\([^)]*\)\.bounds/.test(readFileSync(path, 'utf8'))
			)
			.map((path) => path.slice(viewerSrc.length + 1))
		expect(rawReaders).toEqual([
			'components/scene/model-frame.ts',
			'components/scene/model-measurement.ts'
		])
	})
})
