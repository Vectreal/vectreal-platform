import { describe, expect, it, vi } from 'vitest'

import {
	createKtx2EncoderPool,
	ktx2EncodeWorkerCount,
	MAX_KTX2_ENCODE_WORKERS
} from './ktx2-encoder-pool'

import type {
	Ktx2EncodeReply,
	Ktx2EncodeRequest
} from './ktx2-encode.worker.types'

/** A worker that holds each request until the case replies to it. */
class FakeWorker {
	onmessage: ((event: { data: Ktx2EncodeReply }) => void) | null = null
	onerror:
		((event: { message: string; preventDefault: () => void }) => void) | null =
		null
	onmessageerror: (() => void) | null = null
	requests: Ktx2EncodeRequest[] = []
	terminate = vi.fn()
	postMessage(request: Ktx2EncodeRequest) {
		this.requests.push(request)
	}
	reply(data: Ktx2EncodeReply) {
		this.onmessage?.({ data })
	}
	crash(message: string) {
		this.onerror?.({ message, preventDefault: () => {} })
	}
}

function pool() {
	const workers: FakeWorker[] = []
	const encoders = createKtx2EncoderPool(() => {
		const worker = new FakeWorker()
		workers.push(worker)
		return worker as unknown as Worker
	})
	return { encoders, workers }
}

const source = (width: number) => ({
	image: new Uint8Array(4),
	mimeType: 'image/png',
	width,
	height: 4
})
const options = {
	isUASTC: true,
	isPerceptual: false,
	isSetKTX2SRGBTransferFunc: false,
	generateMipmap: true
}

describe('createKtx2EncoderPool', () => {
	it('starts a worker per encode running at once, and reuses one that is done', async () => {
		const { encoders, workers } = pool()

		const first = encoders.encode(source(4), options)
		const second = encoders.encode(source(8), options)
		expect(workers).toHaveLength(2)
		expect(workers.map((worker) => worker.requests[0].source.width)).toEqual([
			4, 8
		])

		workers[0].reply({ ktx2: new Uint8Array([1]) })
		expect(await first).toEqual(new Uint8Array([1]))

		const third = encoders.encode(source(12), options)
		expect(workers).toHaveLength(2)
		expect(workers[0].requests[1]).toEqual({ source: source(12), options })

		workers[1].reply({ ktx2: new Uint8Array([2]) })
		workers[0].reply({ ktx2: new Uint8Array([3]) })
		expect(await second).toEqual(new Uint8Array([2]))
		expect(await third).toEqual(new Uint8Array([3]))
	})

	it('rejects with the reason the worker gave, and keeps the worker', async () => {
		const { encoders, workers } = pool()

		const failed = encoders.encode(source(4), options)
		workers[0].reply({ error: 'Out of bounds memory access' })
		await expect(failed).rejects.toThrow('Out of bounds memory access')

		void encoders.encode(source(4), options)
		expect(workers).toHaveLength(1)
	})

	it('rejects when its worker crashes, and replaces the worker', async () => {
		const { encoders, workers } = pool()

		const crashed = encoders.encode(source(4), options)
		workers[0].crash('Aw, snap')
		await expect(crashed).rejects.toThrow('Aw, snap')
		expect(workers[0].terminate).toHaveBeenCalled()

		void encoders.encode(source(4), options)
		expect(workers).toHaveLength(2)
	})

	it('ends every worker it started', () => {
		const { encoders, workers } = pool()
		void encoders.encode(source(4), options)
		void encoders.encode(source(4), options)

		encoders.dispose()

		expect(
			workers.every((worker) => worker.terminate.mock.calls.length === 1)
		).toBe(true)
	})
})

describe('ktx2EncodeWorkerCount', () => {
	it('leaves one core to the page', () => {
		expect(ktx2EncodeWorkerCount(3)).toBe(2)
	})

	it(`runs no more than ${MAX_KTX2_ENCODE_WORKERS}`, () => {
		expect(ktx2EncodeWorkerCount(16)).toBe(MAX_KTX2_ENCODE_WORKERS)
	})

	it('runs one on a single core, or when the browser does not say', () => {
		expect(ktx2EncodeWorkerCount(1)).toBe(1)
		expect(ktx2EncodeWorkerCount(0)).toBe(1)
	})
})
