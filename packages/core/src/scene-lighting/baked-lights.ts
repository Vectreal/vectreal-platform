import { litLights } from './light-direction'

import type { ResolvedLighting } from './resolve-lighting'

/** The glTF extension the baked studio lights travel in. */
export const LIGHTMAP_EXTENSION = 'VECTREAL_lightmap'

/** What three's loader keeps of a material's baked lights, on `userData`. */
export interface BakedLightmapInfo {
	/** The encoded texel's square, times this, is the light it holds. */
	scale: number
	/** The lights it was baked from; see {@link bakedLightsSignature}. */
	signature: string
}

/** The key three's loader stores {@link BakedLightmapInfo} under. */
export const BAKED_LIGHTMAP_USER_DATA = 'vectrealLightmap'

/**
 * What a light map holds, as a string: the lights that contribute, where they
 * stand once the environment has turned them, how large, strong and colored
 * they are. A map baked from lighting with another signature is not the
 * scene's light, so the viewer draws the live lights instead. The
 * environment's map and brightness are left out: they scale the baked light
 * at draw time exactly as they scale the live lights.
 */
export function bakedLightsSignature(
	lighting: Pick<ResolvedLighting, 'lights' | 'environment'>
): string {
	const round = (value: number) => Math.round(value * 1000) / 1000
	return JSON.stringify({
		rotation: round(lighting.environment.rotation),
		lights: litLights(lighting).map((light) => [
			light.role,
			round(light.azimuth),
			round(light.elevation),
			round(light.size),
			round(light.intensity),
			light.color.toLowerCase()
		])
	})
}
