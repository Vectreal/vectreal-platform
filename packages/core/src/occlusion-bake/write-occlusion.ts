import type { Document, Material } from '@gltf-transform/core'

/** One material's baked occlusion, encoded as an image glTF accepts. */
export interface BakedOcclusionImage {
	material: Material
	image: Uint8Array
	mimeType: 'image/png'
}

/*
  Writes each bake as the material's standard occlusionTexture, read from the
  first UV set, so any glTF viewer applies it. Occlusion is read from the red
  channel and dims only ambient and environment light, never direct lights.
*/
export function writeOcclusionBake(
	document: Document,
	baked: BakedOcclusionImage[]
): void {
	for (const { material, image, mimeType } of baked) {
		const name = `${material.getName() || 'material'}_occlusion`
		const texture = document
			.createTexture(name)
			.setImage(image)
			.setMimeType(mimeType)
		material.setOcclusionTexture(texture).setOcclusionStrength(1)
		material.getOcclusionTextureInfo()?.setTexCoord(0)
	}
}
