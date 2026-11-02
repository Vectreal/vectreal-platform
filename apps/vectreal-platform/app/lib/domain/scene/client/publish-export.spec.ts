import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	projectPublishedGlbBytes,
	resolvePublishGeometryOptions,
	runPublishExportInWorker
} from './publish-export'

import type { DracoCompressionReport, Optimizations } from '@vctrl/core'

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
			glb: new Uint8Array(4),
			draco: {},
			dracoWorthApplying: true,
			ktx2: true,
			occlusion: false,
			lights: false
		},
		onProgress,
		timeoutMs
	)

/** The page, shown until a test hides it. */
const page = Object.assign(new EventTarget(), { hidden: false })
const setHidden = (hidden: boolean) => {
	page.hidden = hidden
	page.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
	FakeWorker.instances = []
	vi.stubGlobal('Worker', FakeWorker)
	page.hidden = false
	vi.stubGlobal('document', page)
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

	it('runs a crashed export once more, in a fresh worker started after the first is gone', async () => {
		const pending = run()
		const crashed = lastWorker()
		crashed.onerror?.({ message: 'out of memory' })
		await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2))

		const retry = lastWorker()
		// Terminated before the retry started, so two copies are never alive.
		expect(crashed.terminate.mock.invocationCallOrder[0]).toBeLessThan(
			retry.postMessage.mock.invocationCallOrder[0]
		)
		// A copy of its own: the first went to the crashed worker.
		const [message, transfer] = retry.postMessage.mock.calls[0]
		expect(transfer).toEqual([message.buffer])
		expect(message.buffer).not.toBe(crashed.postMessage.mock.calls[0][0].buffer)

		const done = { type: 'done', buffer: new ArrayBuffer(2) }
		retry.reply(done)
		await expect(pending).resolves.toBe(done)
	})

	it('rejects as a crash when the retry crashes too, and stops there', async () => {
		const pending = run()
		lastWorker().onerror?.({ message: 'out of memory' })
		await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2))
		lastWorker().onerror?.({ message: 'out of memory' })

		await expect(pending).rejects.toMatchObject({
			name: 'WorkerRunError',
			failure: 'crashed',
			message: 'out of memory'
		})
		expect(FakeWorker.instances).toHaveLength(2)
		expect(lastWorker().terminate).toHaveBeenCalled()
	})

	it('does not run a timed-out export again', async () => {
		const pending = run(vi.fn(), 1_000)
		vi.advanceTimersByTime(1_000)

		await expect(pending).rejects.toMatchObject({ failure: 'timed-out' })
		expect(FakeWorker.instances).toHaveLength(1)
	})

	it('rejects and terminates on a message that fails structured clone', async () => {
		const pending = run()
		lastWorker().onmessageerror?.()

		await expect(pending).rejects.toThrow(/undeserializable/)
		expect(lastWorker().terminate).toHaveBeenCalled()
	})

	it('stops a UV layout past its limit, and exports again without one', async () => {
		const onProgress = vi.fn()
		const pending = runPublishExportInWorker(
			{
				glb: new Uint8Array(4),
				dracoWorthApplying: true,
				ktx2: false,
				occlusion: true,
				lights: false
			},
			onProgress,
			10_000,
			500
		)
		const laying = lastWorker()
		laying.reply({ type: 'progress', stage: 'uvs' })
		vi.advanceTimersByTime(500)
		await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2))

		expect(laying.terminate).toHaveBeenCalled()
		expect(onProgress).toHaveBeenCalledWith({ type: 'progress', stage: 'uvs' })
		const retry = lastWorker()
		expect(retry.postMessage.mock.calls[0][0]).toMatchObject({
			occlusion: true,
			generateUvs: false
		})
		const done = { type: 'done', buffer: new ArrayBuffer(2) }
		retry.reply(done)
		await expect(pending).resolves.toBe(done)
	})

	it('does not lay out again after a layout crashed the worker', async () => {
		const pending = runPublishExportInWorker(
			{
				glb: new Uint8Array(4),
				dracoWorthApplying: true,
				ktx2: false,
				occlusion: true,
				lights: false
			},
			vi.fn(),
			10_000,
			500
		)
		const laying = lastWorker()
		laying.reply({ type: 'progress', stage: 'uvs' })
		laying.onerror?.({ message: 'out of memory' })
		await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2))

		const retry = lastWorker()
		expect(retry.postMessage.mock.calls[0][0]).toMatchObject({
			generateUvs: false
		})
		const done = { type: 'done', buffer: new ArrayBuffer(2) }
		retry.reply(done)
		await expect(pending).resolves.toBe(done)
	})

	it('does not lay out again after a layout ran out of time and the run after it crashed', async () => {
		const pending = runPublishExportInWorker(
			{
				glb: new Uint8Array(4),
				dracoWorthApplying: true,
				ktx2: false,
				occlusion: true,
				lights: false
			},
			vi.fn(),
			10_000,
			500
		)
		lastWorker().reply({ type: 'progress', stage: 'uvs' })
		vi.advanceTimersByTime(500)
		await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2))
		lastWorker().onerror?.({ message: 'out of memory' })
		await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(3))

		expect(lastWorker().postMessage.mock.calls[0][0]).toMatchObject({
			generateUvs: false
		})
		const done = { type: 'done', buffer: new ArrayBuffer(2) }
		lastWorker().reply(done)
		await expect(pending).resolves.toBe(done)
	})

	it('stops counting a UV layout’s limit once the bake after it reports', async () => {
		const pending = runPublishExportInWorker(
			{
				glb: new Uint8Array(4),
				dracoWorthApplying: true,
				ktx2: false,
				occlusion: true,
				lights: false
			},
			vi.fn(),
			10_000,
			500
		)
		const worker = lastWorker()
		worker.reply({ type: 'progress', stage: 'uvs' })
		vi.advanceTimersByTime(400)
		worker.reply({ type: 'progress', stage: 'occlusion', fraction: 0.5 })
		vi.advanceTimersByTime(1_000)

		expect(worker.terminate).not.toHaveBeenCalled()
		const done = { type: 'done', buffer: new ArrayBuffer(2) }
		worker.reply(done)
		await expect(pending).resolves.toBe(done)
		expect(FakeWorker.instances).toHaveLength(1)
	})

	describe('a bake that stops reporting', () => {
		const STALL_MS = 500
		const bake = (lights = false) =>
			runPublishExportInWorker(
				{
					glb: new Uint8Array(4),
					dracoWorthApplying: true,
					ktx2: false,
					occlusion: true,
					lights: lights && { lights: [], environment: {} as never }
				},
				vi.fn(),
				10_000,
				10_000,
				STALL_MS
			)
		const done = { type: 'done', buffer: new ArrayBuffer(2) }

		it('is stopped, and the export runs again without it, reporting it as stalled', async () => {
			const pending = bake()
			const stalling = lastWorker()
			stalling.reply({
				type: 'progress',
				stage: 'occlusion',
				fraction: 0.25,
				gpuTimer: false
			})
			vi.advanceTimersByTime(STALL_MS)
			await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2))

			expect(stalling.terminate).toHaveBeenCalled()
			expect(lastWorker().postMessage.mock.calls[0][0]).toMatchObject({
				occlusion: false
			})
			lastWorker().reply(done)
			await expect(pending).resolves.toEqual({
				...done,
				occlusion: {
					failed: 'stalled',
					detail:
						'occlusion made no progress for 0.5s at 25.00% (GPU timer: no)'
				}
			})
		})

		it('runs on while it keeps reporting', async () => {
			const pending = bake()
			const worker = lastWorker()
			for (const fraction of [0, 0.25, 0.5]) {
				worker.reply({ type: 'progress', stage: 'occlusion', fraction })
				vi.advanceTimersByTime(STALL_MS - 1)
			}

			worker.reply(done)
			await expect(pending).resolves.toBe(done)
			expect(FakeWorker.instances).toHaveLength(1)
		})

		it('is not stopped once it has ended, drawn or not', async () => {
			const pending = bake()
			const worker = lastWorker()
			worker.reply({
				type: 'progress',
				stage: 'occlusion',
				fraction: 0.25,
				ended: true
			})
			vi.advanceTimersByTime(STALL_MS * 10)

			worker.reply(done)
			await expect(pending).resolves.toBe(done)
			expect(worker.terminate).toHaveBeenCalledOnce()
		})

		it('is not counted against while the page is hidden', async () => {
			const pending = bake()
			const worker = lastWorker()
			worker.reply({ type: 'progress', stage: 'occlusion', fraction: 0.25 })
			vi.advanceTimersByTime(STALL_MS - 100)
			setHidden(true)
			vi.advanceTimersByTime(STALL_MS * 10)
			expect(worker.terminate).not.toHaveBeenCalled()

			// Shown again, its limit starts over.
			setHidden(false)
			vi.advanceTimersByTime(STALL_MS - 1)
			expect(worker.terminate).not.toHaveBeenCalled()
			vi.advanceTimersByTime(1)
			await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2))
			lastWorker().reply(done)
			await expect(pending).resolves.toMatchObject({
				occlusion: { failed: 'stalled' }
			})
		})

		it('keeps the other bake, and stops it too if it stalls in turn', async () => {
			const pending = bake(true)
			lastWorker().reply({ type: 'progress', stage: 'occlusion', fraction: 0 })
			vi.advanceTimersByTime(STALL_MS)
			await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2))
			expect(lastWorker().postMessage.mock.calls[0][0]).toMatchObject({
				occlusion: false,
				lights: { lights: [] }
			})

			lastWorker().reply({ type: 'progress', stage: 'lights', fraction: 0.5 })
			vi.advanceTimersByTime(STALL_MS)
			await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(3))
			expect(lastWorker().postMessage.mock.calls[0][0]).toMatchObject({
				occlusion: false,
				lights: false
			})

			lastWorker().reply(done)
			await expect(pending).resolves.toMatchObject({
				occlusion: { failed: 'stalled' },
				lights: {
					failed: 'stalled',
					detail:
						'lights made no progress for 0.5s at 50.00% (GPU timer: unknown)'
				}
			})
		})
	})

	it('pauses a UV layout’s limit while the page is hidden', async () => {
		const pending = runPublishExportInWorker(
			{
				glb: new Uint8Array(4),
				dracoWorthApplying: true,
				ktx2: false,
				occlusion: true,
				lights: false
			},
			vi.fn(),
			10_000,
			500
		)
		const worker = lastWorker()
		worker.reply({ type: 'progress', stage: 'uvs' })
		setHidden(true)
		vi.advanceTimersByTime(5_000)

		expect(worker.terminate).not.toHaveBeenCalled()
		const done = { type: 'done', buffer: new ArrayBuffer(2) }
		worker.reply(done)
		await expect(pending).resolves.toBe(done)
	})

	it('cancels its timeout once the worker has answered', async () => {
		const pending = run(vi.fn(), 1_000)
		lastWorker().reply({ type: 'error', message: 'no' })
		await expect(pending).rejects.toThrow('no')

		vi.advanceTimersByTime(1_000)
		expect(lastWorker().terminate).toHaveBeenCalledOnce()
	})
})

describe('projectPublishedGlbBytes', () => {
	// GPU texture encoding is seconds per texture, so the projection leaves it
	// to publish and runs the rest of the export as publish does.
	it('runs the publish export without GPU textures and measures its file', async () => {
		const working = new Uint8Array([1, 2, 3, 4])
		const pending = projectPublishedGlbBytes(working, {
			draco: { quantizePosition: 14 },
			dracoWorthApplying: false
		})
		const worker = lastWorker()
		expect(worker.postMessage.mock.calls[0][0]).toMatchObject({
			type: 'export',
			draco: { quantizePosition: 14 },
			dracoWorthApplying: false,
			ktx2: false,
			occlusion: false,
			lights: false
		})

		worker.reply({
			type: 'done',
			buffer: new ArrayBuffer(3),
			geometryCodec: 'none',
			textureBytes: 0
		})

		await expect(pending).resolves.toBe(3)
		// Sent a copy: the caller's GLB is still whole.
		expect(working.byteLength).toBe(4)
	})
})

describe('resolvePublishGeometryOptions', () => {
	const withDraco = (draco: Optimizations['draco']) =>
		({ draco }) as Optimizations
	const report = (isWorthApplying: boolean) =>
		({ isWorthApplying }) as DracoCompressionReport

	it('passes Draco’s options on without its switch', () => {
		expect(
			resolvePublishGeometryOptions(
				withDraco({ enabled: true, quantizePosition: 14 }),
				null
			)
		).toEqual({ draco: { quantizePosition: 14 }, dracoWorthApplying: true })
	})

	it('turns geometry compression off when Draco is off or absent', () => {
		expect(
			resolvePublishGeometryOptions(withDraco({ enabled: false }), null).draco
		).toBeUndefined()
		expect(
			resolvePublishGeometryOptions({} as Optimizations, null).draco
		).toBeUndefined()
	})

	it('leaves Draco out of the contest only when it measured larger', () => {
		const draco = withDraco({ enabled: true })
		expect(
			resolvePublishGeometryOptions(draco, report(false)).dracoWorthApplying
		).toBe(false)
		expect(
			resolvePublishGeometryOptions(draco, report(true)).dracoWorthApplying
		).toBe(true)
	})
})
