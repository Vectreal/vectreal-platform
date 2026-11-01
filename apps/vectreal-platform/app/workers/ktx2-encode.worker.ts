/* vectreal-platform | KTX2 Encode Web Worker
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>. */

/**
 * Encodes one texture at a time to KTX2 for the publish export worker, which
 * runs several of these so textures encode on several cores. The Basis
 * encoder is single-threaded wasm: its own threads need cross-origin
 * isolation, which the app does not have.
 */

import { BrowserBasisEncoder } from 'ktx2-encoder'

import type {
	Ktx2EncodeReply,
	Ktx2EncodeRequest
} from './ktx2-encode.worker.types'

/** Self-hosted, and matched to the bundled glue by `public-codec-files.spec.ts`. */
const ENCODER_WASM_URL = '/basis-encoder/basis_encoder.wasm'

const basisEncoder = new BrowserBasisEncoder()

let pixelReader: WebGL2RenderingContext | null = null

/**
 * A texture's pixels as straight RGBA at the size it is encoded at, rows top
 * first. Read through WebGL rather than a 2D canvas, which stores colour
 * premultiplied and loses the colour of any texel with little alpha.
 */
async function decodeRgba(bytes: Uint8Array, width: number, height: number) {
	const bitmap = await createImageBitmap(
		new Blob([bytes as Uint8Array<ArrayBuffer>]),
		{
			resizeWidth: width,
			resizeHeight: height,
			resizeQuality: 'high',
			premultiplyAlpha: 'none',
			colorSpaceConversion: 'none'
		}
	)
	try {
		pixelReader ??= new OffscreenCanvas(1, 1).getContext('webgl2', {
			premultipliedAlpha: false
		})
		const gl = pixelReader
		if (!gl) throw new Error('WebGL2 is unavailable to read texture pixels')

		const texture = gl.createTexture()
		const framebuffer = gl.createFramebuffer()
		gl.bindTexture(gl.TEXTURE_2D, texture)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			texture,
			0
		)
		const data = new Uint8Array(width * height * 4)
		const readable =
			gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
		if (readable) {
			gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data)
		}
		const error = gl.getError()
		gl.deleteFramebuffer(framebuffer)
		gl.deleteTexture(texture)
		// Unchecked, a failed upload reads back as zeros and ships black.
		if (!readable || error !== gl.NO_ERROR) {
			throw new Error(`WebGL could not read the texture back (${error})`)
		}

		return { data, width, height }
	} finally {
		bitmap.close()
	}
}

self.onmessage = async ({
	data: { source, options }
}: MessageEvent<Ktx2EncodeRequest>) => {
	let reply: Ktx2EncodeReply
	try {
		reply = {
			ktx2: await basisEncoder.encode(source.image, {
				...options,
				wasmUrl: ENCODER_WASM_URL,
				imageDecoder: (bytes) => decodeRgba(bytes, source.width, source.height)
			})
		}
	} catch (error) {
		reply = {
			error: error instanceof Error ? error.message : 'KTX2 encode failed'
		}
	}
	self.postMessage(reply, {
		transfer: 'ktx2' in reply ? [reply.ktx2.buffer] : []
	})
}
