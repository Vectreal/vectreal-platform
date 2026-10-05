import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runPublishExportInWorker } from './publish-export'

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

	reply(data: unknown) {
		this.onmessage?.({ data } as MessageEvent)
	}
}

const lastWorker = () => FakeWorker.instances[FakeWorker.instances.length - 1]

const run = (onProgress = vi.fn(), timeoutMs = 1_000) =>
	runPublishExportInWorker(
		{
			buffer: new ArrayBuffer(4),
			draco: {},
			dracoWorthApplying: true,
			ktx2: true
		},
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

describe('runPublishExportInWorker', () => {
	it('transfers the GLB to the worker and resolves with what it encoded', async () => {
		const onProgress = vi.fn()
		const pending = run(onProgress)
		const worker = lastWorker()
		const [message, transfer] = worker.postMessage.mock.calls[0]
		expect(message).toMatchObject({ type: 'export', ktx2: true })
		expect(transfer).toEqual([message.buffer])

		worker.reply({ type: 'progress', texturesDone: 1, texturesTotal: 2 })
		const done = {
			type: 'done',
			buffer: new ArrayBuffer(2),
			geometryCodec: 'meshopt'
		}
		worker.reply(done)

		await expect(pending).resolves.toBe(done)
		expect(onProgress).toHaveBeenCalledWith(
			expect.objectContaining({ texturesDone: 1, texturesTotal: 2 })
		)
		expect(worker.terminate).toHaveBeenCalled()
	})

	it('rejects with the worker’s error, and terminates it', async () => {
		const pending = run()
		lastWorker().reply({ type: 'error', message: 'Draco encoder failed' })

		await expect(pending).rejects.toThrow('Draco encoder failed')
		expect(lastWorker().terminate).toHaveBeenCalled()
	})

	it('terminates the worker when the budget expires', async () => {
		const pending = run(vi.fn(), 1_000)
		vi.advanceTimersByTime(1_000)

		await expect(pending).rejects.toThrow(/timed out after 1s/)
		expect(lastWorker().terminate).toHaveBeenCalled()
	})
})
