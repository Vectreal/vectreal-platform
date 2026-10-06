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

import { EXTTextureWebP, KHRTextureBasisu } from '@gltf-transform/extensions'
import { listTextureSlots } from '@gltf-transform/functions'

import type { Document, Texture } from '@gltf-transform/core'

/**
 * The Basis Universal encoder options a texture is encoded with, in the shape
 * `ktx2-encoder` takes them.
 */
export interface BasisEncodeOptions {
	isUASTC: boolean
	isPerceptual: boolean
	isSetKTX2SRGBTransferFunc: boolean
	generateMipmap: boolean
	needSupercompression?: boolean
	enableRDO?: boolean
	/** RDO strength for UASTC; higher is smaller after supercompression. */
	rdoQualityLevel?: number
	/** UASTC pack effort, 0 (fastest) to 3. */
	uastcLDRQualityLevel?: number
	isNormalMap?: boolean
}

/** What the encoder is handed for one texture. */
export interface Ktx2EncodeSource {
	image: Uint8Array
	mimeType: string
	/** The size to encode at: within `KTX2_MAX_EDGE` and in whole 4×4 blocks. */
	width: number
	height: number
}

export type Ktx2Encoder = (
	source: Ktx2EncodeSource,
	options: BasisEncodeOptions
) => Promise<Uint8Array>

export interface Ktx2CompressionReport {
	encoded: string[]
	/** Textures left as they were, and why. */
	kept: { texture: string; reason: string }[]
}

/**
 * Slots whose texels are sRGB colour. ETC1S is lossy in a way the eye forgives
 * in colour; everything else is data a shader reads as numbers.
 */
const COLOR_SLOTS = new Set([
	'baseColorTexture',
	'emissiveTexture',
	'sheenColorTexture',
	'specularColorTexture'
])

const NORMAL_SLOTS = new Set(['normalTexture', 'clearcoatNormalTexture'])

/** The longest edge a texture is encoded at. */
export const KTX2_MAX_EDGE = 2048

/**
 * How many times its source's size a KTX2 texture may be before the source is
 * kept instead. KTX2 trades bytes for GPU memory and decode time, and the
 * trade stops being worth it, and starts eating the scene's storage quota,
 * well before a texture triples.
 */
export const KTX2_MAX_GROWTH = 3

/**
 * The encoder options for a texture used in `slots`.
 *
 * Colour gets ETC1S, small and perceptual. Data maps get UASTC in linear
 * space: ETC1S's block artefacts are visible in normals and roughness, and
 * an sRGB transfer function would bend values the shader reads directly. A
 * texture in both kinds of slot is data, because UASTC is fine for colour and
 * the reverse is not true.
 *
 * UASTC packs at its fastest level, which on a sample scene cut a publish from
 * 150 s to 36 s for a small loss in quality. Data maps other than normals take
 * a stronger rate-distortion pass, which shrinks them by about a third after
 * supercompression; normals keep the default, being the map where its error
 * shows.
 */
export function basisOptionsForSlots(
	slots: readonly string[]
): BasisEncodeOptions {
	if (slots.length > 0 && slots.every((slot) => COLOR_SLOTS.has(slot))) {
		return {
			isUASTC: false,
			isPerceptual: true,
			isSetKTX2SRGBTransferFunc: true,
			generateMipmap: true
		}
	}

	const isNormalMap = slots.some((slot) => NORMAL_SLOTS.has(slot))
	return {
		isUASTC: true,
		isPerceptual: false,
		isSetKTX2SRGBTransferFunc: false,
		needSupercompression: true,
		enableRDO: true,
		uastcLDRQualityLevel: 0,
		generateMipmap: true,
		...(isNormalMap ? { isNormalMap: true } : { rdoQualityLevel: 4 })
	}
}

/**
 * The size a texture is encoded at: scaled down to `KTX2_MAX_EDGE`, which also
 * keeps it inside the encoder's 12-megapixel limit, and rounded to whole 4×4
 * blocks, which compressed formats need for every mip level to upload.
 */
export function ktx2EncodeSize([width, height]: readonly [number, number]): [
	number,
	number
] {
	const scale = Math.min(1, KTX2_MAX_EDGE / Math.max(width, height))
	const toBlocks = (edge: number) =>
		Math.max(4, Math.round((edge * scale) / 4) * 4)
	return [toBlocks(width), toBlocks(height)]
}

/** A texture's size, or null when its header is missing or malformed. */
function readTextureSize(texture: Texture) {
	try {
		return texture.getSize()
	} catch {
		return null
	}
}

const textureLabel = (texture: Texture, index: number) =>
	texture.getName() || texture.getURI() || `texture ${index + 1}`

/**
 * Encodes `document`'s textures to KTX2 under `KHR_texture_basisu`.
 *
 * A texture the encoder cannot take, or that would grow past
 * `KTX2_MAX_GROWTH`, keeps its source and is reported, so one bad texture
 * never fails a publish. Meant for an export clone: the working document stays
 * in a format the optimizer and editor can read back.
 */
export async function compressTexturesToKtx2(
	document: Document,
	{
		encode,
		onProgress
	}: {
		encode: Ktx2Encoder
		onProgress?: (done: number, total: number) => void
	}
): Promise<Ktx2CompressionReport> {
	const report: Ktx2CompressionReport = { encoded: [], kept: [] }
	const textures = document
		.getRoot()
		.listTextures()
		.filter(
			(texture) => texture.getImage() && texture.getMimeType() !== 'image/ktx2'
		)

	for (const [index, texture] of textures.entries()) {
		onProgress?.(index, textures.length)
		const label = textureLabel(texture, index)
		const image = texture.getImage() as Uint8Array
		const size = readTextureSize(texture)

		if (!size) {
			report.kept.push({ texture: label, reason: 'its size could not be read' })
			continue
		}

		const [width, height] = ktx2EncodeSize(size)
		let ktx2: Uint8Array
		try {
			ktx2 = await encode(
				{ image, mimeType: texture.getMimeType(), width, height },
				basisOptionsForSlots(listTextureSlots(texture))
			)
		} catch (error) {
			report.kept.push({
				texture: label,
				reason: error instanceof Error ? error.message : String(error)
			})
			continue
		}

		if (ktx2.byteLength > image.byteLength * KTX2_MAX_GROWTH) {
			report.kept.push({
				texture: label,
				reason: `KTX2 was more than ${KTX2_MAX_GROWTH}× its size`
			})
			continue
		}

		const uri = texture.getURI()
		texture.setImage(ktx2).setMimeType('image/ktx2')
		if (uri) texture.setURI(uri.replace(/(\.[^./]*)?$/, '.ktx2'))
		report.encoded.push(label)
	}
	onProgress?.(textures.length, textures.length)

	if (report.encoded.length > 0) {
		document.createExtension(KHRTextureBasisu).setRequired(true)
	}

	const webpRemains = document
		.getRoot()
		.listTextures()
		.some((texture) => texture.getMimeType() === 'image/webp')
	if (!webpRemains) {
		document
			.getRoot()
			.listExtensionsUsed()
			.find((extension) => extension instanceof EXTTextureWebP)
			?.dispose()
	}

	return report
}
