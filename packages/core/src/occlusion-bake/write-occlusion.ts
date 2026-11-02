import type { Document, Material, Texture } from '@gltf-transform/core'

/**
 * One material's baked occlusion, encoded as an image glTF accepts, and the
 * UV set it was baked in (0 when absent). Materials on one layout made for
 * the bake pass the same `image`, which is written once.
 */
export interface BakedOcclusionImage {
	material: Material
	image: Uint8Array
	mimeType: 'image/png'
	texCoord?: number
}

/*
  Writes each bake as the material's standard occlusionTexture, read from the
  UV set it was baked in, so any glTF viewer applies it. Occlusion is read
  from the red channel and dims only ambient and environment light, never
  direct lights.
*/
export function writeOcclusionBake(
	document: Document,
	baked: BakedOcclusionImage[]
): void {
	const written = new Map<Uint8Array, Texture>()
	for (const { material, image, mimeType, texCoord = 0 } of baked) {
		let texture = written.get(image)
		if (!texture) {
			const name = `${texCoord === 0 ? material.getName() || 'material' : 'studio'}_occlusion`
			texture = document
				.createTexture(name)
				.setImage(image)
				.setMimeType(mimeType)
			written.set(image, texture)
		}
		material.setOcclusionTexture(texture).setOcclusionStrength(1)
		material.getOcclusionTextureInfo()?.setTexCoord(texCoord)
	}
}
