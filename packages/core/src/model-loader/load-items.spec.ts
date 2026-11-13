import { afterEach, describe, expect, it, vi } from 'vitest'

import { ModelLoader } from './model-loader'

import type { OperationProgress } from '../types'

/**
 * A parse counts the files it loads through its own `LoadingManager`.
 *
 * Mutation gate, executed: drop the `this.reportItems(tracked)` call in
 * `createThreeLoader` and this goes red.
 */
describe('ModelLoader item progress', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('reports the files a parse loads, as a count', async () => {
		const triangle = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
		const base64 = Buffer.from(triangle.buffer).toString('base64')
		const gltf = {
			asset: { version: '2.0' },
			buffers: [
				{
					byteLength: triangle.byteLength,
					uri: `data:application/octet-stream;base64,${base64}`
				}
			],
			bufferViews: [{ buffer: 0, byteLength: triangle.byteLength }],
			accessors: [
				{
					bufferView: 0,
					componentType: 5126,
					count: 3,
					type: 'VEC3',
					min: [0, 0, 0],
					max: [1, 1, 0]
				}
			],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
			nodes: [{ mesh: 0 }],
			scenes: [{ nodes: [0] }],
			scene: 0
		}
		// three's FileLoader reports through a browser event Node does not have.
		if (typeof ProgressEvent === 'undefined') {
			vi.stubGlobal(
				'ProgressEvent',
				class extends Event {
					constructor(type: string, init: object = {}) {
						super(type)
						Object.assign(this, init)
					}
				}
			)
		}
		const loader = new ModelLoader()
		const reports: OperationProgress[] = []
		loader.onProgress((progress) => reports.push(progress))

		await loader.parseGLTFJsonToThreeJS(gltf, new Map())

		const items = reports.flatMap((report) =>
			report.items ? [report.items] : []
		)
		expect(items.at(-1)).toEqual({ loaded: 1, total: 1 })
		// The count never moves the percentage the last step set.
		const itemReport = reports.find((report) => report.items)
		expect(itemReport?.progress).toBe(25)
	})
})
