import { afterEach, beforeEach, vi } from 'vitest'

import { runGeometryOptimizationsInWorker } from './geometry-worker'

/**
 * The worker helper owns the Worker's lifetime, so these cover the exits that
 * used to leave one running: an expired budget (the timeout used to sit outside
 * this scope, where it could reject but never terminate) and a message that
 * fails structured clone (which fires neither `onmessage` nor `onerror`).
 */
class FakeWorker {
	static instances: FakeWorker[] = []

	onmessage: ((event: MessageEvent) => void) | null = null
	onmessageerror: (() => void) | null = null
	onerror: ((err: { message?: string }) => void) | null = null
	terminate = vi.fn()
	postMessage = vi.fn()

	constructor() {
		FakeWorker.instances.push(this)
	}
}

const lastWorker = () => FakeWorker.instances[FakeWorker.instances.length - 1]

const run = (timeoutMs: number, onProgress = vi.fn()) =>
	runGeometryOptimizationsInWorker(
		new Uint8Array([1, 2, 3]),
		{ dedup: {} },
		onProgress,
		timeoutMs
	)

beforeEach(() => {
	FakeWorker.instances = []
	vi.stubGlobal('Worker', FakeWorker)
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe('runGeometryOptimizationsInWorker', () => {
	it('terminates the worker when the budget expires', async () => {
		const pending = run(1_000)
		const worker = lastWorker()

		vi.advanceTimersByTime(1_000)

		await expect(pending).rejects.toThrow(/timed out after 1000ms/)
		expect(worker.terminate).toHaveBeenCalled()
	})

	it('rejects and terminates on an undeserializable message', async () => {
		const pending = run(1_000)
		const worker = lastWorker()

		worker.onmessageerror?.()

		await expect(pending).rejects.toThrow(/undeserializable/)
		expect(worker.terminate).toHaveBeenCalled()
	})

	it('clears the timer once the worker is done', async () => {
		const buffer = new Uint8Array([9, 9]).buffer
		const pending = run(1_000)
		const worker = lastWorker()

		worker.onmessage?.({
			data: {
				type: 'done',
				buffer,
				appliedOptimizations: ['dedup'],
				dracoReport: undefined
			}
		} as MessageEvent)

		await expect(pending).resolves.toMatchObject({
			appliedOptimizations: ['dedup']
		})
		expect(worker.terminate).toHaveBeenCalledTimes(1)

		// Would fire the timeout's reject on an already-settled promise if the
		// timer had been left pending.
		vi.advanceTimersByTime(5_000)
		expect(worker.terminate).toHaveBeenCalledTimes(1)
	})

	it('does not settle on progress messages', async () => {
		const onProgress = vi.fn()
		const pending = run(1_000, onProgress)
		const worker = lastWorker()

		worker.onmessage?.({
			data: { type: 'progress', step: 'dedup', progress: 40 }
		} as MessageEvent)

		expect(onProgress).toHaveBeenCalledWith('dedup', 40)
		expect(worker.terminate).not.toHaveBeenCalled()

		vi.advanceTimersByTime(1_000)
		await expect(pending).rejects.toThrow(/timed out/)
	})
})
