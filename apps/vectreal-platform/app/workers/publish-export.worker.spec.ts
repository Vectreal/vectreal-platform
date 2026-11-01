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
	encode: vi.fn(),
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
vi.mock('ktx2-encoder', () => ({
	BrowserBasisEncoder: class {
		encode = mocks.encode
	}
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
			stage: 'textures',
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
			expect.any(Function),
			undefined,
			expect.any(Function)
		)
		expect(mocks.disposeRenderer).toHaveBeenCalledOnce()
		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: occlusionReport
		})
	})

	it('reports how far each bake has drawn, a few times a second and always its end', async () => {
		const reportDrawn = async (onProgress: (fraction: number) => void) => {
			onProgress(0.25)
			// Sooner than the interval after the last, so held back.
			onProgress(0.5)
			onProgress(1)
		}
		mocks.bakeOcclusionIntoDocument.mockImplementation(
			async (_d, _r, _o, onProgress) => {
				await reportDrawn(onProgress)
				return occlusionReport
			}
		)
		mocks.bakeLightsIntoDocument.mockImplementation(
			async (_d, _l, _r, _o, onProgress) => {
				await reportDrawn(onProgress)
				return lightsReport
			}
		)

		const messages = await send({
			dracoWorthApplying: true,
			ktx2: false,
			occlusion: true,
			lights: lighting
		})

		expect(messages.filter(({ type }) => type === 'progress')).toEqual([
			{ type: 'progress', stage: 'occlusion', fraction: 0.25 },
			{ type: 'progress', stage: 'occlusion', fraction: 1 },
			{ type: 'progress', stage: 'lights', fraction: 0.25 },
			{ type: 'progress', stage: 'lights', fraction: 1 }
		])
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
			expect.any(Function),
			undefined,
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

	it('encodes through the self-hosted wasm at the size it was given', async () => {
		mocks.compressTextures.mockImplementation(async ({ encode }) => {
			await encode(
				{
					image: new Uint8Array(4),
					mimeType: 'image/webp',
					width: 8,
					height: 4
				},
				{ isUASTC: false }
			)
			return report
		})

		await send({ dracoWorthApplying: true, ktx2: true })

		expect(mocks.encode).toHaveBeenCalledWith(
			new Uint8Array(4),
			expect.objectContaining({
				isUASTC: false,
				wasmUrl: '/basis-encoder/basis_encoder.wasm',
				imageDecoder: expect.any(Function)
			})
		)
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

	describe('reading a texture back for the encoder', () => {
		const FRAMEBUFFER_COMPLETE = 0x8cd5
		const NO_ERROR = 0

		/** A WebGL2 context whose read-back outcome the case decides. */
		function stubWebGl(status: number, error: number) {
			const gl = {
				FRAMEBUFFER_COMPLETE,
				NO_ERROR,
				createTexture: vi.fn(() => ({})),
				createFramebuffer: vi.fn(() => ({})),
				bindTexture: vi.fn(),
				texImage2D: vi.fn(),
				bindFramebuffer: vi.fn(),
				framebufferTexture2D: vi.fn(),
				checkFramebufferStatus: vi.fn(() => status),
				readPixels: vi.fn((...args: unknown[]) => {
					;(args[6] as Uint8Array).fill(200)
				}),
				getError: vi.fn(() => error),
				deleteFramebuffer: vi.fn(),
				deleteTexture: vi.fn()
			}
			vi.stubGlobal(
				'OffscreenCanvas',
				class {
					getContext = () => gl
				}
			)
			vi.stubGlobal(
				'createImageBitmap',
				vi.fn(async () => ({ close: vi.fn() }))
			)
			return gl
		}

		async function decoderFor() {
			let decode:
				((bytes: Uint8Array) => Promise<{ data: Uint8Array }>) | undefined
			mocks.encode.mockImplementation(async (_image, options) => {
				decode = options.imageDecoder
				return new Uint8Array(1)
			})
			mocks.compressTextures.mockImplementation(async ({ encode }) => {
				await encode(
					{
						image: new Uint8Array(4),
						mimeType: 'image/webp',
						width: 2,
						height: 2
					},
					{}
				)
				return report
			})
			await send({ dracoWorthApplying: true, ktx2: true })
			return decode as (bytes: Uint8Array) => Promise<{ data: Uint8Array }>
		}

		it('hands the encoder the pixels it read', async () => {
			stubWebGl(FRAMEBUFFER_COMPLETE, NO_ERROR)
			const decode = await decoderFor()

			const { data } = await decode(new Uint8Array(4))
			expect(data).toHaveLength(2 * 2 * 4)
			expect(data.every((value) => value === 200)).toBe(true)
		})

		it('refuses a texture the framebuffer cannot read, rather than ship it black', async () => {
			const gl = stubWebGl(0, NO_ERROR)
			const decode = await decoderFor()

			await expect(decode(new Uint8Array(4))).rejects.toThrow(
				/read the texture/
			)
			expect(gl.readPixels).not.toHaveBeenCalled()
			expect(gl.deleteTexture).toHaveBeenCalled()
		})

		it('refuses a texture WebGL reported an error for', async () => {
			stubWebGl(FRAMEBUFFER_COMPLETE, 0x0505)
			const decode = await decoderFor()

			await expect(decode(new Uint8Array(4))).rejects.toThrow(/1285/)
		})
	})
})
