import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	lightBakeWarning,
	occlusionBakeWarning,
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
			buffer: new ArrayBuffer(4),
			draco: {},
			dracoWorthApplying: true,
			ktx2: true,
			occlusion: false,
			lights: false
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

	it('rejects and terminates when the worker crashes', async () => {
		const pending = run()
		lastWorker().onerror?.({ message: 'out of memory' })

		await expect(pending).rejects.toThrow('out of memory')
		expect(lastWorker().terminate).toHaveBeenCalled()
	})

	it('rejects and terminates on a message that fails structured clone', async () => {
		const pending = run()
		lastWorker().onmessageerror?.()

		await expect(pending).rejects.toThrow(/undeserializable/)
		expect(lastWorker().terminate).toHaveBeenCalled()
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

describe('occlusionBakeWarning', () => {
	it('stays quiet for a material that kept its own occlusion map', () => {
		expect(
			occlusionBakeWarning({
				baked: ['body'],
				skipped: [{ material: 'tyre', reason: 'existing-occlusion' }]
			})
		).toBeNull()
	})

	it('counts the materials that missed out and names the first', () => {
		expect(
			occlusionBakeWarning({
				baked: [],
				skipped: [
					{ material: 'tyre', reason: 'existing-occlusion' },
					{ material: 'wheel', reason: 'shared-geometry' },
					{ material: 'decal', reason: 'tiling-uvs' }
				]
			})
		).toEqual({
			message: "2 materials could not take the studio finish's depth.",
			description: 'wheel: its mesh is placed more than once'
		})
	})

	it('says nothing when no bake was asked for', () => {
		expect(occlusionBakeWarning(undefined)).toBeNull()
	})
})

describe('lightBakeWarning', () => {
	it('says the scene shipped with live lights when the bake failed', () => {
		expect(lightBakeWarning({ failed: 'WebGL 2 is unavailable' })).toEqual({
			message:
				'The studio finish could not draw the studio lights, so the scene was published with them live.',
			description: 'WebGL 2 is unavailable'
		})
	})

	it('counts the materials that kept live lights and names the first', () => {
		expect(
			lightBakeWarning({
				baked: ['body'],
				skipped: [{ material: 'wheel', reason: 'shared-geometry' }]
			})
		).toEqual({
			message:
				"1 material could not take the studio finish's lights and keeps them live.",
			description: 'wheel: its mesh is placed more than once'
		})
	})

	it('stays quiet when everything took the bake, or nothing was asked', () => {
		expect(lightBakeWarning({ baked: ['body'], skipped: [] })).toBeNull()
		expect(lightBakeWarning(undefined)).toBeNull()
	})
})
