/**
 * What three's loader makes of `VECTREAL_lightmap`. Decoding the texture
 * needs a browser, so the parser hands over a ready texture here.
 */
import { Texture, type MeshStandardMaterialParameters } from 'three'
import { describe, expect, it } from 'vitest'

import { registerBakedLightmap } from './baked-lightmap-plugin'
import { BAKED_LIGHTMAP_USER_DATA } from '../scene-lighting/baked-lights'

import type {
	GLTFLoader,
	GLTFLoaderPlugin,
	GLTFParser
} from 'three/examples/jsm/loaders/GLTFLoader.js'

async function materialParams(extensions?: object) {
	let plugin: GLTFLoaderPlugin | undefined
	const loader = {
		register: (factory: (parser: GLTFParser) => GLTFLoaderPlugin) => {
			plugin = factory({
				json: { materials: [{ extensions }] },
				getDependency: async () => new Texture()
			} as unknown as GLTFParser)
		}
	} as unknown as GLTFLoader
	registerBakedLightmap(loader)

	const params: MeshStandardMaterialParameters = { userData: { kept: true } }
	await plugin!.extendMaterialParams!(0, params)
	return params
}

describe('the baked light map, as three loads it', () => {
	it('arrives as the light map, switched off until the viewer turns it on', async () => {
		const params = await materialParams({
			VECTREAL_lightmap: {
				lightmapTexture: { index: 0, texCoord: 0 },
				scale: 2.5,
				signature: 'baked-from'
			}
		})

		expect(params.lightMap).toBeInstanceOf(Texture)
		expect(params.lightMap?.channel).toBe(0)
		expect(params.lightMapIntensity).toBe(0)
		expect(params.userData).toEqual({
			kept: true,
			[BAKED_LIGHTMAP_USER_DATA]: { scale: 2.5, signature: 'baked-from' }
		})
	})

	it('leaves a material without one alone', async () => {
		const params = await materialParams()

		expect(params.lightMap).toBeUndefined()
		expect(params.userData).toEqual({ kept: true })
	})
})
