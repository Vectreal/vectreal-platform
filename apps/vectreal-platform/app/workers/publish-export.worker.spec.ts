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
	exportDocumentGLBForPublish: vi.fn(),
	compressTexturesToKtx2: vi.fn(),
	encode: vi.fn()
}))

vi.mock('@vctrl/core/model-exporter', () => ({
	ModelExporter: class {
		exportDocumentGLBForPublish = mocks.exportDocumentGLBForPublish
	}
}))
vi.mock('@vctrl/core/model-optimizer', () => ({
	compressTexturesToKtx2: mocks.compressTexturesToKtx2
}))
vi.mock('ktx2-encoder', () => ({
	BrowserBasisEncoder: class {
		encode = mocks.encode
	}
}))

const posted: Array<{ message: PublishExportMessage; transfer: unknown }> = []
const report = { encoded: ['color'], kept: [] }

async function send(request: Omit<PublishExportRequest, 'type' | 'buffer'>) {
	const buffer = (await new WebIO().writeBinary(new Document())).slice()
		.buffer as ArrayBuffer
	await (
		self.onmessage as (event: MessageEvent<PublishExportRequest>) => unknown
	)({ data: { type: 'export', buffer, ...request } } as MessageEvent)
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
	mocks.compressTexturesToKtx2.mockImplementation(
		async (_document, { onProgress }) => {
			onProgress(0, 1)
			return report
		}
	)
	mocks.exportDocumentGLBForPublish.mockImplementation(
		async (
			document: Document,
			options: { textures?: (d: Document) => Promise<void> }
		) => {
			await options.textures?.(document)
			return {
				data: new Uint8Array([1, 2, 3]),
				geometryCodec: 'meshopt',
				geometrySizes: { none: 3, meshopt: 2 }
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

		expect(mocks.exportDocumentGLBForPublish).toHaveBeenCalledWith(
			expect.any(Document),
			expect.objectContaining({
				draco: { method: 'edgebreaker' },
				dracoWorthApplying: false
			})
		)
		expect(mocks.compressTexturesToKtx2).toHaveBeenCalledOnce()
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
			textures: report
		})
		const { buffer } = done as { buffer: ArrayBuffer }
		expect(Array.from(new Uint8Array(buffer))).toEqual([1, 2, 3])
		expect(posted.at(-1)?.transfer).toEqual([buffer])
	})

	it('leaves textures alone when KTX2 is off', async () => {
		const messages = await send({ dracoWorthApplying: true, ktx2: false })

		expect(mocks.compressTexturesToKtx2).not.toHaveBeenCalled()
		expect(messages.at(-1)).toMatchObject({ type: 'done', textures: undefined })
	})

	it('encodes through the self-hosted wasm at the size it was given', async () => {
		mocks.compressTexturesToKtx2.mockImplementation(
			async (_document, { encode }) => {
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
			}
		)

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
		mocks.exportDocumentGLBForPublish.mockRejectedValue(
			new Error('Draco encoder failed')
		)

		const messages = await send({ dracoWorthApplying: true, ktx2: false })

		expect(messages).toEqual([
			{ type: 'error', message: 'Draco encoder failed' }
		])
	})
})
