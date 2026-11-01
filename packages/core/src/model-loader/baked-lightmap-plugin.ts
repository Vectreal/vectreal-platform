import {
	BAKED_LIGHTMAP_USER_DATA,
	LIGHTMAP_EXTENSION,
	type BakedLightmapInfo
} from '../scene-lighting/baked-lights'

import type { MeshStandardMaterialParameters, Texture } from 'three'
import type {
	GLTFLoader,
	GLTFLoaderPlugin,
	GLTFParser
} from 'three/examples/jsm/loaders/GLTFLoader.js'

interface LightmapDef extends BakedLightmapInfo {
	lightmapTexture: { index: number; texCoord?: number }
}

/**
 * Reads `VECTREAL_lightmap` into the material three builds: the map as its
 * `lightMap` at intensity 0, so a renderer that does not know the encoding
 * adds nothing, and the scale and signature on `userData`, where the Vectreal
 * viewer finds them and turns the map on for the lighting it was baked from.
 * `userData` is copied as JSON when a material is cloned, so the texture
 * itself never goes there.
 */
export function registerBakedLightmap(loader: GLTFLoader): void {
	loader.register((parser: GLTFParser): GLTFLoaderPlugin => ({
		name: LIGHTMAP_EXTENSION,
		extendMaterialParams: async (
			materialIndex: number,
			params: MeshStandardMaterialParameters
		) => {
			const def = parser.json.materials?.[materialIndex]?.extensions?.[
				LIGHTMAP_EXTENSION
			] as LightmapDef | undefined
			if (!def) return
			const texture: Texture = await parser.getDependency(
				'texture',
				def.lightmapTexture.index
			)
			texture.channel = def.lightmapTexture.texCoord ?? 0
			params.lightMap = texture
			params.lightMapIntensity = 0
			params.userData = {
				...params.userData,
				[BAKED_LIGHTMAP_USER_DATA]: {
					scale: def.scale,
					signature: def.signature
				} satisfies BakedLightmapInfo
			}
		}
	}))
}
