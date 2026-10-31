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
vi.mock('three', () => ({
	WebGLRenderer: class {
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
/** What the export hands its `occlusion` hook. */
const exportedDocument = new Document()

async function send({
	occlusion = false,
	...request
}: Omit<PublishExportRequest, 'type' | 'buffer' | 'occlusion'> & {
	occlusion?: boolean
}) {
	const buffer = (await new WebIO().writeBinary(new Document())).slice()
		.buffer as ArrayBuffer
	await (
		self.onmessage as (event: MessageEvent<PublishExportRequest>) => unknown
	)({ data: { type: 'export', buffer, occlusion, ...request } } as MessageEvent)
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
	mocks.bakeOcclusionIntoDocument.mockResolvedValue(occlusionReport)
	vi.stubGlobal('OffscreenCanvas', class {})
	mocks.exportGlbForPublish.mockImplementation(
		async (
			_glb: Uint8Array,
			options: {
				ktx2?: unknown
				occlusion?: (document: Document) => Promise<void>
			}
		) => ({
			...(await options.occlusion?.(exportedDocument)),
			data: new Uint8Array([1, 2, 3]),
			geometryCodec: 'meshopt',
			geometrySizes: { none: 3, meshopt: 2 },
			textureBytes: 7,
			textures: options.ktx2
				? await mocks.compressTextures(options.ktx2)
				: undefined
		})
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
			expect.any(Object)
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
			expect.objectContaining({ occlusion: undefined })
		)
		expect(mocks.bakeOcclusionIntoDocument).not.toHaveBeenCalled()
		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: undefined
		})
	})

	it('publishes without occlusion when the bake fails, and says why', async () => {
		mocks.bakeOcclusionIntoDocument.mockRejectedValue(
			new Error('WebGL 2 is unavailable')
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
