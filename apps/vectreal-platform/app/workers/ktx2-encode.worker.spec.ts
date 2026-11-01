import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
	Ktx2EncodeReply,
	Ktx2EncodeRequest
} from './ktx2-encode.worker.types'

const mocks = vi.hoisted(() => ({ encode: vi.fn() }))

vi.mock('ktx2-encoder', () => ({
	BrowserBasisEncoder: class {
		encode = mocks.encode
	}
}))

const posted: Array<{ reply: Ktx2EncodeReply; transfer: unknown }> = []

async function send(request: Ktx2EncodeRequest) {
	await (self.onmessage as (event: MessageEvent<Ktx2EncodeRequest>) => unknown)(
		{ data: request } as MessageEvent
	)
	return posted.at(-1)
}

const request: Ktx2EncodeRequest = {
	source: {
		image: new Uint8Array(4),
		mimeType: 'image/webp',
		width: 2,
		height: 2
	},
	options: {
		isUASTC: false,
		isPerceptual: true,
		isSetKTX2SRGBTransferFunc: true,
		generateMipmap: true
	}
}

beforeEach(async () => {
	posted.length = 0
	vi.clearAllMocks()
	vi.stubGlobal('self', globalThis)
	vi.stubGlobal(
		'postMessage',
		(reply: Ktx2EncodeReply, options: { transfer: unknown }) =>
			posted.push({ reply, transfer: options.transfer })
	)
	vi.resetModules()
	await import('./ktx2-encode.worker')
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('the KTX2 encode worker', () => {
	it('encodes through the self-hosted wasm and hands the bytes back', async () => {
		const ktx2 = new Uint8Array([0xab, 0x4b])
		mocks.encode.mockResolvedValue(ktx2)

		const sent = await send(request)

		expect(mocks.encode).toHaveBeenCalledWith(
			request.source.image,
			expect.objectContaining({
				isUASTC: false,
				wasmUrl: '/basis-encoder/basis_encoder.wasm',
				imageDecoder: expect.any(Function)
			})
		)
		expect(sent).toEqual({ reply: { ktx2 }, transfer: [ktx2.buffer] })
	})

	it('replies with the reason when the encoder fails', async () => {
		mocks.encode.mockRejectedValue(new Error('Out of bounds memory access'))

		expect(await send(request)).toEqual({
			reply: { error: 'Out of bounds memory access' },
			transfer: []
		})
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
			await send(request)
			return decode as (bytes: Uint8Array) => Promise<{ data: Uint8Array }>
		}

		it('decodes at the size it was asked to encode at', async () => {
			stubWebGl(FRAMEBUFFER_COMPLETE, NO_ERROR)
			const decode = await decoderFor()

			await decode(new Uint8Array(4))
			expect(createImageBitmap).toHaveBeenCalledWith(
				expect.any(Blob),
				expect.objectContaining({ resizeWidth: 2, resizeHeight: 2 })
			)
		})

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
