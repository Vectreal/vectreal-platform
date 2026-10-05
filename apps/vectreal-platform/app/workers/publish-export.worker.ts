/* vectreal-platform | Publish Export Web Worker
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
 * Encodes the GLB a scene is published as, off the main thread: textures to
 * KTX2, then geometry in whichever of Draco and meshopt ships it cheapest.
 * Each is seconds of CPU per texture or mesh, and on the main thread that was
 * a frozen publisher.
 */

import { WebIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { ModelExporter } from '@vctrl/core/model-exporter'
import { compressTexturesToKtx2 } from '@vctrl/core/model-optimizer'
import { BrowserBasisEncoder } from 'ktx2-encoder'

import type {
	PublishExportMessage,
	PublishExportRequest
} from './publish-export.worker.types'
import type {
	Ktx2CompressionReport,
	Ktx2Encoder
} from '@vctrl/core/model-optimizer'

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
		gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data)
		gl.deleteFramebuffer(framebuffer)
		gl.deleteTexture(texture)

		return { data, width, height }
	} finally {
		bitmap.close()
	}
}

const encodeKtx2: Ktx2Encoder = ({ image, width, height }, options) =>
	basisEncoder.encode(image, {
		...options,
		wasmUrl: ENCODER_WASM_URL,
		imageDecoder: (bytes) => decodeRgba(bytes, width, height)
	})

function post(message: PublishExportMessage, transfer: Transferable[] = []) {
	self.postMessage(message, { transfer })
}

self.onmessage = async (event: MessageEvent<PublishExportRequest>) => {
	const { type, buffer, draco, dracoWorthApplying, ktx2 } = event.data
	if (type !== 'export') return

	try {
		const document = await new WebIO()
			.registerExtensions(ALL_EXTENSIONS)
			.readBinary(new Uint8Array(buffer))

		let textures: Ktx2CompressionReport | undefined
		const result = await new ModelExporter().exportDocumentGLBForPublish(
			document,
			{
				draco,
				dracoWorthApplying,
				textures: ktx2
					? async (clone) => {
							textures = await compressTexturesToKtx2(clone, {
								encode: encodeKtx2,
								onProgress: (texturesDone, texturesTotal) =>
									post({ type: 'progress', texturesDone, texturesTotal })
							})
						}
					: undefined
			}
		)

		const output = result.data.buffer.slice(
			result.data.byteOffset,
			result.data.byteOffset + result.data.byteLength
		) as ArrayBuffer
		post(
			{
				type: 'done',
				buffer: output,
				geometryCodec: result.geometryCodec,
				geometrySizes: result.geometrySizes,
				textures
			},
			[output]
		)
	} catch (error) {
		post({
			type: 'error',
			message: error instanceof Error ? error.message : 'Publish export failed'
		})
	}
}
