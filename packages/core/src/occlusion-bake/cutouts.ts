import { Matrix3, Vector2 } from 'three'

import type { ScenePrimitive } from './scene-primitives'
import type { Material, Primitive } from '@gltf-transform/core'
import type { Transform } from '@gltf-transform/extensions'

/** Image types a browser or worker decodes on its own, so a mask can be read. */
const READABLE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/** Width and height each mask is resampled to, the light map's own default. */
export const MASK_SIZE = 512
/**
 * Most masks one bake reads, 16 MB of single-byte layers at most. A masked
 * material past the first this many readable ones casts solid. The WebGL 2
 * minimum for an array texture is 256 layers.
 */
export const MAX_MASK_LAYERS = 64

/** How a mask repeats past the unit square: 0 repeat, 1 clamp, 2 mirror. */
const WRAP_CODES: Record<number, number> = { 10497: 0, 33071: 1, 33648: 2 }

/**
 * What decides which texels of an alpha-masked material let light through:
 * its base color alpha (factor times texture) against its cutoff.
 */
export interface CutoutMask {
	cutoff: number
	alphaFactor: number
	/** The base color image, or null when only the factor sets the alpha. */
	image: Uint8Array | null
	mimeType: string
	/** The UV set the base color texture reads. */
	texCoord: number
	/** `KHR_texture_transform` as a 3x3 UV matrix, column-major. */
	uvTransform: number[]
	/** The texture's wrap along u and v, as `WRAP_CODES` numbers them. */
	wrap: [number, number]
}

/**
 * The cutout a part casts through, when it is alpha-masked and the mask can
 * be read. Undefined for an opaque part, and for a mask whose image a browser
 * cannot decode, such as KTX2: the bake then traces that part as solid.
 */
export function readableCutout(
	material: Material | null
): CutoutMask | undefined {
	if (material?.getAlphaMode() !== 'MASK') return undefined
	const texture = material.getBaseColorTexture()
	const info = material.getBaseColorTextureInfo()
	const mimeType = texture?.getMimeType() ?? ''
	if (texture && !READABLE_IMAGE_TYPES.includes(mimeType)) return undefined
	const transform = info?.getExtension<Transform>('KHR_texture_transform')
	return {
		cutoff: material.getAlphaCutoff(),
		alphaFactor: material.getBaseColorFactor()[3],
		image: texture?.getImage() ?? null,
		mimeType,
		texCoord: transform?.getTexCoord() ?? info?.getTexCoord() ?? 0,
		uvTransform: uvMatrix(transform),
		wrap: [
			WRAP_CODES[info?.getWrapS() ?? 10497] ?? 0,
			WRAP_CODES[info?.getWrapT() ?? 10497] ?? 0
		]
	}
}

/*
  The transform as three's loader applies it to a texture: offset, then
  rotation, then scale, about the UV origin.
*/
function uvMatrix(transform: Transform | null | undefined): number[] {
	const [x, y] = transform?.getOffset() ?? [0, 0]
	const [sx, sy] = transform?.getScale() ?? [1, 1]
	return new Matrix3()
		.setUvTransform(x, y, sx, sy, transform?.getRotation() ?? 0, 0, 0)
		.toArray()
}

/** The part's mask UVs, transformed, one pair per vertex. */
export function cutoutUvs(
	primitive: Primitive,
	{ texCoord, uvTransform }: CutoutMask
): Float32Array {
	const accessor = primitive.getAttribute(`TEXCOORD_${texCoord}`)
	const count = primitive.getAttribute('POSITION')?.getCount() ?? 0
	const uvs = new Float32Array(count * 2)
	if (!accessor) return uvs
	const matrix = new Matrix3().fromArray(uvTransform)
	const element = [0, 0]
	const uv = new Vector2()
	for (let i = 0; i < count; i++) {
		accessor.getElement(i, element)
		uv.set(element[0], element[1]).applyMatrix3(matrix)
		uvs[i * 2] = uv.x
		uvs[i * 2 + 1] = uv.y
	}
	return uvs
}

/**
 * Each vertex's `COLOR_0` alpha, which glTF multiplies into the alpha a
 * cutoff is tested against; 1 where the part has no RGBA colors.
 */
export function cutoutVertexAlphas(primitive: Primitive): Float32Array {
	const count = primitive.getAttribute('POSITION')?.getCount() ?? 0
	const alphas = new Float32Array(count).fill(1)
	const colors = primitive.getAttribute('COLOR_0')
	if (colors?.getType() !== 'VEC4') return alphas
	const element = [0, 0, 0, 0]
	for (let i = 0; i < count; i++) {
		colors.getElement(i, element)
		alphas[i] = element[3]
	}
	return alphas
}

/** One layer per readable cutout, and the layer each material landed on. */
export interface CutoutLayers {
	/** `MASK_SIZE` squared alpha bytes per layer, factor applied. */
	layers: Uint8Array
	/** Four bytes per layer: its wrap along u and v, its cutoff times 255, 0. */
	params: Uint8Array
	layerOf: Map<Material, { layer: number; mask: CutoutMask }>
}

/*
  Decodes each distinct cutout among the casting parts. One whose image does
  not decode, or that comes past `MAX_MASK_LAYERS`, gets no layer and so casts
  solid, as it did before cutouts were read at all: a broken leaf texture
  should not stop the rest of the model from baking.
*/
export async function decodeCutoutMasks(
	casting: ScenePrimitive[]
): Promise<CutoutLayers> {
	const area = MASK_SIZE * MASK_SIZE
	const decoded: { material: Material; mask: CutoutMask; alpha: Uint8Array }[] =
		[]
	const seen = new Set<Material>()
	for (const { material } of casting) {
		const mask = readableCutout(material)
		if (!material || !mask || seen.has(material)) continue
		seen.add(material)
		if (decoded.length === MAX_MASK_LAYERS) break
		const alpha = mask.image
			? await decodeAlpha(mask.image, mask.mimeType).catch(() => undefined)
			: new Uint8Array(area).fill(255)
		if (alpha) decoded.push({ material, mask, alpha })
	}

	const layers = new Uint8Array(Math.max(decoded.length, 1) * area)
	const params = new Uint8Array(Math.max(decoded.length, 1) * 4)
	const layerOf: CutoutLayers['layerOf'] = new Map()
	decoded.forEach(({ material, mask, alpha }, layer) => {
		for (let i = 0; i < area; i++) {
			layers[layer * area + i] = Math.round(alpha[i] * mask.alphaFactor)
		}
		// Casters never cut off above 1 (`castsOcclusion`); below 0, out of
		// spec, every texel is drawn, as a cutoff of 0 draws them.
		params.set(
			[...mask.wrap, Math.round(Math.max(mask.cutoff, 0) * 255), 0],
			layer * 4
		)
		layerOf.set(material, { layer, mask })
	})
	return { layers, params, layerOf }
}

/** An image's alpha, resampled to `MASK_SIZE` squared, row 0 at UV v = 0. */
async function decodeAlpha(
	image: Uint8Array,
	mimeType: string
): Promise<Uint8Array> {
	const bitmap = await createImageBitmap(
		new Blob([image as Uint8Array<ArrayBuffer>], { type: mimeType }),
		{ premultiplyAlpha: 'none', colorSpaceConversion: 'none' }
	)
	const canvas = new OffscreenCanvas(MASK_SIZE, MASK_SIZE)
	const context = canvas.getContext('2d')
	if (!context) throw new Error('No 2D canvas context to read a cutout mask')
	// Filtered, so a thin strand in a large atlas averages in rather than
	// dropping between two samples.
	context.imageSmoothingQuality = 'high'
	context.drawImage(bitmap, 0, 0, MASK_SIZE, MASK_SIZE)
	bitmap.close()
	const rgba = context.getImageData(0, 0, MASK_SIZE, MASK_SIZE).data
	const alpha = new Uint8Array(MASK_SIZE * MASK_SIZE)
	for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]
	return alpha
}
