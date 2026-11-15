import { browserImageCodec, type ImageCodec } from './image-codec'

import type { UvBake } from './uv-trace'
import type { Material, Texture } from '@gltf-transform/core'

/** Image types a browser or worker decodes on its own. */
const PACKABLE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/**
 * The type a packed image is written in. Lossless, because JPEG and lossy
 * WebP code color as luma and subsampled chroma: occlusion written into red
 * would bleed into green and blue, roughness and metalness, at every edge.
 */
const PACKED_TYPE = 'image/png'

/**
 * The metallic-roughness texture a material's bake can be packed into, or
 * undefined when packing would change something other than occlusion.
 *
 * glTF reads occlusion from red and metallic-roughness from green and blue,
 * so one image can carry both (ORM) when both are read the same way: the bake
 * is on the material's own first UV set, which the texture reads untransformed;
 * no other material or slot uses the texture, so writing its red channel
 * touches nothing else; it is at least as large as the bake, so the bake is
 * resampled up and loses nothing; and it holds 8 bits a channel, all a canvas
 * reads back, so a 16-bit PNG keeps its precision by staying as it is.
 */
export function packableMetallicRoughness(
	material: Material,
	{ size, texCoord = 0 }: Pick<UvBake, 'size' | 'texCoord'>
): Texture | undefined {
	const texture = material.getMetallicRoughnessTexture()
	const info = material.getMetallicRoughnessTextureInfo()
	if (!texture || !info || texCoord !== 0 || info.getTexCoord() !== 0) {
		return undefined
	}
	if (info.getExtension('KHR_texture_transform')) return undefined
	if (!PACKABLE_TYPES.includes(texture.getMimeType())) return undefined
	if (texture.getMimeType() === 'image/png' && pngBitDepth(texture) !== 8) {
		return undefined
	}
	const users = texture
		.listParents()
		.filter((parent) => parent.propertyType !== 'Root')
	if (users.length !== 1 || users[0] !== material) return undefined
	if (
		material.getBaseColorTexture() === texture ||
		material.getNormalTexture() === texture ||
		material.getEmissiveTexture() === texture ||
		material.getOcclusionTexture() === texture
	) {
		return undefined
	}
	const [width, height] = texture.getSize() ?? [0, 0]
	if (width < size || height < size) return undefined
	return texture
}

/** A PNG's bit depth, from its header: the byte after width and height. */
function pngBitDepth(texture: Texture): number | undefined {
	return texture.getImage()?.[24]
}

/**
 * `rgba`, a decoded metallic-roughness image, with the bake written into its
 * red channel, resampled bilinearly to the image's size. Undefined when the
 * image is not fully opaque: a canvas stores color premultiplied by alpha, so
 * its green and blue would not survive the round trip.
 */
export function packOcclusionPixels(
	rgba: Uint8ClampedArray,
	width: number,
	height: number,
	{ size, pixels: occlusion }: Pick<UvBake, 'size' | 'pixels'>
): Uint8ClampedArray | undefined {
	for (let i = 3; i < rgba.length; i += 4) {
		if (rgba[i] !== 255) return undefined
	}
	const packed = rgba.slice()
	const at = (x: number, y: number) => occlusion[(y * size + x) * 4]
	for (let y = 0; y < height; y++) {
		const sy = Math.min(
			Math.max(((y + 0.5) / height) * size - 0.5, 0),
			size - 1
		)
		const y0 = Math.floor(sy)
		const y1 = Math.min(y0 + 1, size - 1)
		const fy = sy - y0
		for (let x = 0; x < width; x++) {
			const sx = Math.min(
				Math.max(((x + 0.5) / width) * size - 0.5, 0),
				size - 1
			)
			const x0 = Math.floor(sx)
			const x1 = Math.min(x0 + 1, size - 1)
			const fx = sx - x0
			const top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx
			const bottom = at(x0, y1) * (1 - fx) + at(x1, y1) * fx
			packed[(y * width + x) * 4] = Math.round(top * (1 - fy) + bottom * fy)
		}
	}
	return packed
}

/**
 * Packs one material's bake into the red channel of its metallic-roughness
 * texture and points its occlusion there, when that is safe
 * (`packableMetallicRoughness`) and the packed image, always a PNG
 * (`PACKED_TYPE`), is no larger than the two it replaces: `separate`, the bake
 * encoded on its own, and the texture's current image. Returns whether it packed; when it did not, the document is
 * untouched and the bake is written as its own texture.
 */
export async function packOcclusionIntoMetallicRoughness(
	bake: UvBake,
	separate: Uint8Array,
	codec: ImageCodec = browserImageCodec
): Promise<boolean> {
	const texture = packableMetallicRoughness(bake.material, bake)
	const image = texture?.getImage()
	if (!texture || !image) return false
	const decoded = await codec
		.decode(image, texture.getMimeType())
		.catch(() => undefined)
	if (!decoded) return false
	const packed = packOcclusionPixels(
		decoded.pixels,
		decoded.width,
		decoded.height,
		bake
	)
	if (!packed) return false
	const encoded = await codec
		.encode(packed, decoded.width, decoded.height, PACKED_TYPE)
		.catch(() => undefined)
	if (!encoded || encoded.byteLength > image.byteLength + separate.byteLength) {
		return false
	}

	texture.setImage(encoded).setMimeType(PACKED_TYPE)
	// A file name, when the texture has one, says the type it now holds.
	const uri = texture.getURI()
	if (uri) texture.setURI(uri.replace(/(\.[^./]*)?$/, '.png'))
	const source = bake.material.getMetallicRoughnessTextureInfo()
	bake.material.setOcclusionTexture(texture).setOcclusionStrength(1)
	const info = bake.material.getOcclusionTextureInfo()
	if (source && info) {
		// The same sampler, so the file stores one texture for both slots.
		info
			.setTexCoord(0)
			.setWrapS(source.getWrapS())
			.setWrapT(source.getWrapT())
			.setMinFilter(source.getMinFilter())
			.setMagFilter(source.getMagFilter())
	}
	return true
}
