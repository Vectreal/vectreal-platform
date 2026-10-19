/* vectreal-core | @vctrl/core
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
 * The codecs a publish export needs in Node.js, where neither the browser's
 * Draco scripts nor its WebGL texture reader exist:
 *
 *     const { dracoModules, encodeKtx2 } = createNodePublishCodecs()
 *     const published = await new ModelExporter({ dracoModules })
 *       .exportGlbForPublish(glb, { draco: {}, ktx2: { encode: encodeKtx2 } })
 *
 * Node only. Nothing in a browser bundle imports this subpath.
 */

import draco3d from 'draco3d'
/*
  Resolved through the package's `node` condition, which loads its own Basis
  wasm. Its types resolve through the web entry, so the function both builds
  export is the one used here.
*/
import { encodeToKTX2 } from 'ktx2-encoder'

import type { DracoModules } from '../geometry-codecs/geometry-codecs'
import type { Ktx2Encoder } from '../model-optimizer/ktx2-compression'

/**
 * Held in a binding so no bundler resolves it: core declares no sharp
 * dependency, and its Node callers install it. `texture-compression.ts`
 * explains the browser build error a literal specifier caused.
 */
const SHARP_SPECIFIER = 'sharp'

interface SharpInstance {
	resize: (
		width: number,
		height: number,
		options: { fit: 'fill' }
	) => SharpInstance
	ensureAlpha: () => SharpInstance
	extractChannel: (channel: number) => SharpInstance
	raw: () => SharpInstance
	toBuffer: (options: { resolveWithObject: true }) => Promise<{
		data: Uint8Array
		info: { width: number; height: number }
	}>
}

type SharpFactory = (
	input: Uint8Array,
	options:
		| { autoOrient: true; ignoreIcc: true }
		| { raw: { width: number; height: number; channels: 1 | 3 } }
) => SharpInstance

let sharpPromise: Promise<SharpFactory> | null = null

function loadSharp(): Promise<SharpFactory> {
	sharpPromise ??= import(/* @vite-ignore */ SHARP_SPECIFIER).then(
		(module) => module.default ?? module,
		(error: unknown) => {
			sharpPromise = null
			throw new Error(
				'KTX2 encoding in Node.js reads textures with sharp. Install it: npm install sharp',
				{ cause: error }
			)
		}
	)
	return sharpPromise
}

/**
 * A texture's pixels as straight RGBA at the size it is encoded at, rows top
 * first: what the browser's WebGL reader produces.
 *
 * The colour and the alpha are resized as separate images. sharp premultiplies
 * an image with alpha before resizing it, at 8-bit precision, so a texel at
 * alpha 10 came back as 178, 76, 25 where it held 200, 100, 50: the loss the
 * browser path reads through WebGL to avoid.
 *
 * As the browser does, it keeps the stored values rather than converting an
 * embedded colour profile to sRGB (`colorSpaceConversion: 'none'` there), and
 * it applies EXIF orientation (`createImageBitmap`'s default).
 */
async function decodeRgba(bytes: Uint8Array, width: number, height: number) {
	const sharp = await loadSharp()
	const { data, info } = await sharp(bytes, {
		autoOrient: true,
		ignoreIcc: true
	})
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true })
	if (info.width === width && info.height === height) {
		return { data: new Uint8Array(data), width, height }
	}

	const texels = info.width * info.height
	const colour = new Uint8Array(texels * 3)
	const alpha = new Uint8Array(texels)
	for (let i = 0; i < texels; i++) {
		colour.set(data.subarray(i * 4, i * 4 + 3), i * 3)
		alpha[i] = data[i * 4 + 3]
	}
	const resize = (input: Uint8Array, channels: 1 | 3) => {
		const image = sharp(input, {
			raw: { width: info.width, height: info.height, channels }
		}).resize(width, height, { fit: 'fill' })
		// A one-channel raw image comes back as three; keep only the one.
		return (channels === 1 ? image.extractChannel(0) : image)
			.raw()
			.toBuffer({ resolveWithObject: true })
	}
	const [colourOut, alphaOut] = await Promise.all([
		resize(colour, 3),
		resize(alpha, 1)
	])

	const rgba = new Uint8Array(width * height * 4)
	for (let i = 0; i < width * height; i++) {
		rgba.set(colourOut.data.subarray(i * 3, i * 3 + 3), i * 4)
		rgba[i * 4 + 3] = alphaOut.data[i]
	}
	return { data: rgba, width, height }
}

export interface NodePublishCodecs {
	/** For `new ModelExporter({ dracoModules })`. */
	dracoModules: DracoModules
	/** For `exportGlbForPublish(glb, { ktx2: { encode: encodeKtx2 } })`. */
	encodeKtx2: Ktx2Encoder
}

export function createNodePublishCodecs(): NodePublishCodecs {
	return {
		/*
		  The npm build of the Draco release the publisher self-hosts in
		  `public/draco/`, so a scene encodes to the same bitstream either way.
		  Its factories resolve with a module that has no `then` of its own.
		*/
		dracoModules: {
			encoder: () => draco3d.createEncoderModule(),
			decoder: () => draco3d.createDecoderModule()
		},
		encodeKtx2: ({ image, width, height }, options) =>
			encodeToKTX2(image, {
				...options,
				imageDecoder: (bytes) => decodeRgba(bytes, width, height)
			})
	}
}
