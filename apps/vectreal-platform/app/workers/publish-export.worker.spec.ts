import { Document, WebIO } from '@gltf-transform/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
	PublishExportMessage,
	PublishExportRequest
} from './publish-export.worker.types'

/**
 * What the worker does with a request: the core functions it runs are pinned
 * in `@vctrl/core`; this covers how the request reaches them and how their
 * results reach the main thread.
 */
const mocks = vi.hoisted(() => ({
	exportGlbForPublish: vi.fn(),
	/** Stands in for the KTX2 pass, handed what the worker passed as `ktx2`. */
	compressTextures: vi.fn(),
	createEncoderPool: vi.fn(),
	poolEncode: vi.fn(),
	disposePool: vi.fn(),
	bakeOcclusionIntoDocument: vi.fn(),
	bakeLightsIntoDocument: vi.fn(),
	createRenderer: vi.fn(),
	disposeRenderer: vi.fn()
}))

vi.mock('@vctrl/core/model-exporter', () => ({
	ModelExporter: class {
		exportGlbForPublish = mocks.exportGlbForPublish
	}
}))
vi.mock('@vctrl/core/occlusion-bake', () => ({
	bakeOcclusionIntoDocument: mocks.bakeOcclusionIntoDocument
}))
vi.mock('@vctrl/core/light-bake', () => ({
	bakeLightsIntoDocument: mocks.bakeLightsIntoDocument
}))
vi.mock('three', () => ({
	WebGLRenderer: class {
		constructor() {
			mocks.createRenderer()
		}
		dispose = mocks.disposeRenderer
	}
}))
vi.mock('./ktx2-encoder-pool', () => ({
	createKtx2EncoderPool: (createWorker: () => Worker) => {
		mocks.createEncoderPool(createWorker)
		return { encode: mocks.poolEncode, dispose: mocks.disposePool }
	},
	ktx2EncodeWorkerCount: () => 3
}))

const posted: Array<{ message: PublishExportMessage; transfer: unknown }> = []
const report = { encoded: ['color'], kept: [] }
const occlusionReport = {
	baked: ['body'],
	skipped: [{ material: 'glass', reason: 'no-uv0' }]
}
const lightsReport = { baked: ['body'], skipped: [] }
const lighting = {
	environment: {
		map: 'nature-park',
		resolution: '1k',
		intensity: 1,
		rotation: 0
	},
	lights: [
		{
			role: 'key',
			enabled: true,
			azimuth: 45,
			elevation: 45,
			size: 20,
			intensity: 1,
			color: '#ffffff'
		}
	]
} satisfies PublishExportRequest['lights']
/** What the export hands its `bake` hook. */
const exportedDocument = new Document()

async function send({
	occlusion = false,
	lights = false,
	...request
}: Omit<PublishExportRequest, 'type' | 'buffer' | 'occlusion' | 'lights'> &
	Partial<Pick<PublishExportRequest, 'occlusion' | 'lights'>>) {
	const buffer = (await new WebIO().writeBinary(new Document())).slice()
		.buffer as ArrayBuffer
	await (
		self.onmessage as (event: MessageEvent<PublishExportRequest>) => unknown
	)({
		data: { type: 'export', buffer, occlusion, lights, ...request }
	} as MessageEvent)
	return posted.map(({ message }) => message)
}

beforeEach(async () => {
	posted.length = 0
	vi.clearAllMocks()
	vi.stubGlobal('self', globalThis)
	vi.stubGlobal(
		'postMessage',
		(message: PublishExportMessage, options: { transfer: unknown }) =>
			posted.push({ message, transfer: options.transfer })
	)
	mocks.compressTextures.mockImplementation(async ({ onProgress }) => {
		onProgress(0, 1)
		return report
	})
	// Asks for its renderer, as the real bake does when it has a material.
	mocks.bakeOcclusionIntoDocument.mockImplementation(
		async (_document: Document, renderer: () => unknown) => {
			renderer()
			return occlusionReport
		}
	)
	vi.stubGlobal('OffscreenCanvas', class {})
	mocks.exportGlbForPublish.mockImplementation(
		async (
			_glb: Uint8Array,
			options: {
				ktx2?: unknown
				bake?: (document: Document) => Promise<void>
			}
		) => {
			await options.bake?.(exportedDocument)
			return {
				data: new Uint8Array([1, 2, 3]),
				geometryCodec: 'meshopt',
				geometrySizes: { none: 3, meshopt: 2 },
				textureBytes: 7,
				textures: options.ktx2
					? await mocks.compressTextures(options.ktx2)
					: undefined
			}
		}
	)
	vi.resetModules()
	await import('./publish-export.worker')
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('the publish export worker', () => {
	it('passes the geometry settings through and encodes textures when asked', async () => {
		const messages = await send({
			draco: { method: 'edgebreaker' },
			dracoWorthApplying: false,
			ktx2: true
		})

		expect(mocks.exportGlbForPublish).toHaveBeenCalledWith(
			expect.any(Uint8Array),
			expect.objectContaining({
				draco: { method: 'edgebreaker' },
				dracoWorthApplying: false
			})
		)
		expect(mocks.compressTextures).toHaveBeenCalledOnce()
		expect(messages).toContainEqual({
			type: 'progress',
			texturesDone: 0,
			texturesTotal: 1
		})

		const done = messages.at(-1)
		expect(done).toMatchObject({
			type: 'done',
			geometryCodec: 'meshopt',
			geometrySizes: { none: 3, meshopt: 2 },
			textureBytes: 7,
			textures: report
		})
		const { buffer } = done as { buffer: ArrayBuffer }
		expect(Array.from(new Uint8Array(buffer))).toEqual([1, 2, 3])
		expect(posted.at(-1)?.transfer).toEqual([buffer])
	})

	it('leaves textures alone when KTX2 is off', async () => {
		const messages = await send({ dracoWorthApplying: true, ktx2: false })

		expect(mocks.compressTextures).not.toHaveBeenCalled()
		expect(messages.at(-1)).toMatchObject({ type: 'done', textures: undefined })
	})

	it('bakes occlusion into the published copy when asked, and reports it', async () => {
		const messages = await send({
			dracoWorthApplying: true,
			ktx2: false,
			occlusion: true
		})

		expect(mocks.bakeOcclusionIntoDocument).toHaveBeenCalledWith(
			exportedDocument,
			expect.any(Function)
		)
		expect(mocks.disposeRenderer).toHaveBeenCalledOnce()
		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: occlusionReport
		})
	})

	it('bakes nothing unless asked', async () => {
		const messages = await send({ dracoWorthApplying: true, ktx2: false })

		expect(mocks.exportGlbForPublish).toHaveBeenCalledWith(
			expect.any(Uint8Array),
			expect.objectContaining({ bake: undefined })
		)
		expect(mocks.bakeOcclusionIntoDocument).not.toHaveBeenCalled()
		expect(mocks.bakeLightsIntoDocument).not.toHaveBeenCalled()
		expect(mocks.createRenderer).not.toHaveBeenCalled()
		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: undefined,
			lights: undefined
		})
	})

	it('bakes the lights after the occlusion, on the same renderer, and reports both', async () => {
		const order: string[] = []
		mocks.bakeOcclusionIntoDocument.mockImplementation(
			async (_document: Document, renderer: () => unknown) => {
				order.push('occlusion')
				renderer()
				return occlusionReport
			}
		)
		mocks.bakeLightsIntoDocument.mockImplementation(
			async (
				_document: Document,
				_lighting: unknown,
				renderer: () => unknown
			) => {
				order.push('lights')
				renderer()
				return lightsReport
			}
		)

		const messages = await send({
			dracoWorthApplying: true,
			ktx2: false,
			occlusion: true,
			lights: lighting
		})

		expect(order).toEqual(['occlusion', 'lights'])
		expect(mocks.bakeLightsIntoDocument).toHaveBeenCalledWith(
			exportedDocument,
			lighting,
			expect.any(Function)
		)
		expect(mocks.createRenderer).toHaveBeenCalledOnce()
		expect(mocks.disposeRenderer).toHaveBeenCalledOnce()
		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: occlusionReport,
			lights: lightsReport
		})
	})

	it('publishes without the lights when their bake fails, keeping the occlusion', async () => {
		mocks.bakeLightsIntoDocument.mockRejectedValue(
			new Error('The GPU reset while baking the studio lights')
		)

		const messages = await send({
			dracoWorthApplying: true,
			ktx2: false,
			occlusion: true,
			lights: lighting
		})

		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: occlusionReport,
			lights: { failed: 'The GPU reset while baking the studio lights' }
		})
	})

	it('publishes without occlusion when the bake fails, and says why', async () => {
		mocks.bakeOcclusionIntoDocument.mockImplementation(
			async (_document: Document, renderer: () => unknown) => {
				renderer()
				throw new Error('WebGL 2 is unavailable')
			}
		)

		const messages = await send({
			dracoWorthApplying: true,
			ktx2: false,
			occlusion: true
		})

		expect(mocks.disposeRenderer).toHaveBeenCalledOnce()
		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: { failed: 'WebGL 2 is unavailable' }
		})
	})

	it('encodes textures through its pool, as many at once as it has workers, and ends the pool', async () => {
		const started: string[] = []
		vi.stubGlobal(
			'Worker',
			class {
				constructor(url: URL, options: WorkerOptions) {
					started.push(`${url.pathname} ${options.type}`)
				}
			}
		)
		await send({ dracoWorthApplying: true, ktx2: true })

		expect(mocks.createEncoderPool).toHaveBeenCalledOnce()
		mocks.createEncoderPool.mock.calls[0][0]()
		expect(started).toEqual([
			expect.stringMatching(/\/ktx2-encode\.worker\.ts module$/)
		])
		expect(mocks.compressTextures).toHaveBeenCalledWith(
			expect.objectContaining({ encode: mocks.poolEncode, concurrency: 3 })
		)
		expect(mocks.disposePool).toHaveBeenCalledOnce()
	})

	it('ends the pool when the export fails', async () => {
		mocks.exportGlbForPublish.mockRejectedValue(new Error('Out of memory'))

		await send({ dracoWorthApplying: true, ktx2: true })

		expect(mocks.disposePool).toHaveBeenCalledOnce()
	})

	it('starts no encode workers when KTX2 is off', async () => {
		await send({ dracoWorthApplying: true, ktx2: false })

		expect(mocks.createEncoderPool).not.toHaveBeenCalled()
	})

	it('reports a failure instead of throwing it away', async () => {
		mocks.exportGlbForPublish.mockRejectedValue(
			new Error('Draco encoder failed')
		)

		const messages = await send({ dracoWorthApplying: true, ktx2: false })

		expect(messages).toEqual([
			{ type: 'error', message: 'Draco encoder failed' }
		])
	})
})
