import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
	WorkerInputMessage,
	WorkerOutputMessage
} from './optimization.worker.types'

/**
 * How a request reaches the optimizer: each step asked for runs through its
 * own method, in the worker's order. What each method does is pinned in
 * `@vctrl/core`.
 */
const called = vi.hoisted(() => [] as string[])

vi.mock('@vctrl/core/model-optimizer', () => ({
	ModelOptimizer: class {
		onProgress() {}
		loadFromBuffer = async () => undefined
		simplify = async () => called.push('simplify')
		deduplicate = async () => called.push('deduplicate')
		mergeMeshes = async () => called.push('mergeMeshes')
		quantize = async () => called.push('quantize')
		optimizeNormals = async () => called.push('optimizeNormals')
		measureDracoCompression = async () => called.push('measureDracoCompression')
		export = async () => new Uint8Array([1])
		getAppliedOptimizations = () => []
	}
}))

const posted: WorkerOutputMessage[] = []

async function send(options: WorkerInputMessage['options']) {
	await (
		self.onmessage as (event: MessageEvent<WorkerInputMessage>) => unknown
	)({
		data: { type: 'optimize', buffer: new ArrayBuffer(1), options }
	} as MessageEvent)
}

beforeEach(async () => {
	called.length = 0
	posted.length = 0
	vi.stubGlobal('self', globalThis)
	vi.stubGlobal('postMessage', (message: WorkerOutputMessage) =>
		posted.push(message)
	)
	await import('./optimization.worker')
})

describe('the optimization worker', () => {
	it('merges meshes when asked, between deduplication and quantization', async () => {
		await send({ quantize: {}, merge: {}, dedup: {} })

		expect(called).toEqual(['deduplicate', 'mergeMeshes', 'quantize'])
		expect(posted.at(-1)?.type).toBe('done')
	})

	it('does not merge meshes when the step is not asked for', async () => {
		await send({ dedup: {} })

		expect(called).toEqual(['deduplicate'])
	})
})
