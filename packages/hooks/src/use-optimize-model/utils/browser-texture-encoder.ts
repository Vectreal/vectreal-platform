/* vectreal-core | vctrl/hooks
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
 * Browser-native texture encoder using OffscreenCanvas + createImageBitmap.
 *
 * Returns a sharp-constructor-compatible encoder for use with
 * @vctrl/core's TextureCompressOptions.encoder injection point.
 *
 * Encoding is done entirely in-process with browser native APIs:
 * - OffscreenCanvas.convertToBlob() for WebP/JPEG/PNG encode (hardware accelerated)
 * - createImageBitmap() for decode + optional proportional resize
 *
 * No WASM, no network, no native binaries — zero bundle cost.
 * Works in both the main thread and Web Workers (OffscreenCanvas is available in both).
 *
 * Resize behaviour mirrors sharp's `fit: 'inside', withoutEnlargement: true`:
 * the image is scaled down proportionally to fit within maxWidth × maxHeight,
 * but is never enlarged if it already fits within the bounds.
 */

interface EncodeOptions {
	format: 'webp' | 'jpeg' | 'png'
	/** Quality 0–100 (mapped to 0.0–1.0 for convertToBlob) */
	quality: number
	/** Scale down to fit within this width (never enlarges) */
	maxWidth?: number
	/** Scale down to fit within this height (never enlarges) */
	maxHeight?: number
}

async function encodeWithOffscreenCanvas(
	input: Uint8Array,
	opts: EncodeOptions
): Promise<Uint8Array> {
	const blob = new Blob([input as Uint8Array<ArrayBuffer>])
	const bitmap = await createImageBitmap(blob)

	let { width, height } = bitmap

	if (opts.maxWidth || opts.maxHeight) {
		const scaleW = opts.maxWidth ? opts.maxWidth / width : Infinity
		const scaleH = opts.maxHeight ? opts.maxHeight / height : Infinity
		const scale = Math.min(scaleW, scaleH, 1) // clamp at 1 — never enlarge
		if (scale < 1) {
			width = Math.round(width * scale)
			height = Math.round(height * scale)
		}
	}

	const canvas = new OffscreenCanvas(width, height)
	const ctx = canvas.getContext('2d')
	if (!ctx) {
		bitmap.close()
		throw new Error('OffscreenCanvas 2D context unavailable')
	}

	ctx.drawImage(bitmap, 0, 0, width, height)
	bitmap.close()

	const mimeType =
		opts.format === 'webp'
			? 'image/webp'
			: opts.format === 'jpeg'
				? 'image/jpeg'
				: 'image/png'

	const resultBlob = await canvas.convertToBlob({
		type: mimeType,
		quality: opts.quality / 100
	})

	return new Uint8Array(await resultBlob.arrayBuffer())
}

/**
 * Creates a sharp-constructor-compatible browser encoder.
 *
 * The returned function matches the sharp API surface that gltf-transform uses:
 * `encoder(buffer)` → instance with `.resize()`, `.webp/jpeg/png()`,
 * `.toBuffer()`, and `.metadata()`.
 *
 * Pass the result directly to `TextureCompressOptions.encoder`:
 * ```ts
 * await optimizer.compressTextures({
 *   encoder: createBrowserTextureEncoder(),
 *   targetFormat: 'webp',
 *   quality: 80,
 * })
 * ```
 */
export function createBrowserTextureEncoder() {
	return function browserEncoder(inputBuffer: Uint8Array | ArrayBuffer) {
		const input =
			inputBuffer instanceof Uint8Array
				? inputBuffer
				: new Uint8Array(inputBuffer)

		let targetFormat: 'webp' | 'jpeg' | 'png' = 'webp'
		let quality = 80
		let maxWidth: number | undefined
		let maxHeight: number | undefined

		const instance = {
			resize(w?: number, h?: number, _opts?: unknown) {
				maxWidth = w
				maxHeight = h
				return instance
			},
			webp(opts?: { quality?: number }) {
				targetFormat = 'webp'
				if (typeof opts?.quality === 'number') quality = opts.quality
				return instance
			},
			jpeg(opts?: { quality?: number }) {
				targetFormat = 'jpeg'
				if (typeof opts?.quality === 'number') quality = opts.quality
				return instance
			},
			png(_opts?: unknown) {
				targetFormat = 'png'
				return instance
			},
			/**
			 * sharp-compatible `.toFormat(format, opts)` — gltf-transform calls this
			 * instead of `.webp()` / `.jpeg()` / `.png()` directly.
			 */
			toFormat(
				format: string,
				opts?: { quality?: number; lossless?: boolean; nearLossless?: boolean }
			) {
				if (format === 'webp' || format === 'jpeg' || format === 'png') {
					targetFormat = format
				}
				if (typeof opts?.quality === 'number') quality = opts.quality
				return instance
			},
			async toBuffer(): Promise<Uint8Array> {
				return encodeWithOffscreenCanvas(input, {
					format: targetFormat,
					quality,
					maxWidth,
					maxHeight
				})
			},
			async metadata(): Promise<{
				width: number
				height: number
				format: string
			}> {
				const blob = new Blob([input as Uint8Array<ArrayBuffer>])
				const bitmap = await createImageBitmap(blob)
				const result = {
					width: bitmap.width,
					height: bitmap.height,
					format: 'unknown'
				}
				bitmap.close()
				return result
			}
		}

		return instance
	}
}
