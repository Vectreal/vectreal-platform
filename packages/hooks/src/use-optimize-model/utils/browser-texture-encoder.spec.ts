/**
 * The encoder hands back the format it was asked for, or refuses.
 *
 * A canvas that cannot write a type returns a PNG instead of failing, and
 * WebKit cannot write WebP. gltf-transform labels whatever comes back with the
 * type it asked for, so on Safari the camera sample's nine 4K JPEGs (18 MB)
 * became 190 MB of PNG filed as WebP, and the tab ran out of memory writing it.
 *
 * The canvases below model two engines: WebKit writes JPEG and PNG, Chromium
 * WebP as well, and both answer a request for anything else with a PNG. Like
 * Chromium, neither encodes a canvas that has no rendering context.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	canEncodeImage,
	createBrowserTextureEncoder
} from './browser-texture-encoder'

const decode = vi.fn(async () => ({ width: 4, height: 4, close: () => {} }))

function canvasWriting(writable: readonly string[]) {
	return class {
		private hasContext = false

		getContext() {
			this.hasContext = true
			return { drawImage: () => {} }
		}

		async convertToBlob({ type }: { type: string }) {
			if (!this.hasContext) {
				throw new DOMException('no rendering context', 'InvalidStateError')
			}
			return new Blob([type], {
				type: writable.includes(type) ? type : 'image/png'
			})
		}
	}
}

const webkit = canvasWriting(['image/png', 'image/jpeg'])
const chromium = canvasWriting(['image/png', 'image/jpeg', 'image/webp'])

const encodeAs = (format: string) =>
	createBrowserTextureEncoder()(new Uint8Array([1]))
		.toFormat(format, { quality: 80 })
		.toBuffer()

beforeEach(() => {
	decode.mockClear()
	vi.stubGlobal('createImageBitmap', decode)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('createBrowserTextureEncoder', () => {
	it('refuses WebP where the canvas would write PNG, before decoding anything', async () => {
		vi.stubGlobal('OffscreenCanvas', webkit)

		await expect(encodeAs('webp')).rejects.toThrow(
			'This browser cannot write image/webp.'
		)
		expect(decode).not.toHaveBeenCalled()
	})

	it('still writes the formats that browser can encode', async () => {
		vi.stubGlobal('OffscreenCanvas', webkit)

		for (const format of ['jpeg', 'png']) {
			const bytes = await encodeAs(format)
			expect(new TextDecoder().decode(bytes)).toBe(`image/${format}`)
		}
	})

	it('writes WebP where the canvas can', async () => {
		vi.stubGlobal('OffscreenCanvas', chromium)

		const bytes = await encodeAs('webp')

		expect(new TextDecoder().decode(bytes)).toBe('image/webp')
	})

	it('refuses a format it was asked for rather than writing another', async () => {
		vi.stubGlobal('OffscreenCanvas', chromium)

		await expect(encodeAs('avif')).rejects.toThrow(
			'This browser cannot write image/avif.'
		)
	})
})

describe('canEncodeImage', () => {
	it('says no where there is no OffscreenCanvas at all', async () => {
		vi.stubGlobal('OffscreenCanvas', undefined)

		await expect(canEncodeImage('png')).resolves.toBe(false)
	})
})
