import { EXTTextureWebP } from '@gltf-transform/extensions'

import type { Document } from '@gltf-transform/core'

/**
 * Drops `EXT_texture_webp` once no texture is WebP, so a file whose WebP
 * images were all rewritten does not still require a loader to support it.
 */
export function dropUnusedWebpExtension(document: Document): void {
	const webpRemains = document
		.getRoot()
		.listTextures()
		.some((texture) => texture.getMimeType() === 'image/webp')
	if (webpRemains) return
	document
		.getRoot()
		.listExtensionsUsed()
		.find((extension) => extension instanceof EXTTextureWebP)
		?.dispose()
}
