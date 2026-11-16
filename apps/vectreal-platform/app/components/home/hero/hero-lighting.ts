import {
	LIGHTING_SETUPS,
	resolveLighting,
	type LightingSettings
} from '@vctrl/core'

const SOFT_STUDIO = LIGHTING_SETUPS.find((setup) => setup.id === 'soft-studio')

if (!SOFT_STUDIO) throw new Error('The Soft studio lighting setup is missing')

/**
 * The hero's lighting, as the Publisher saves it for the Soft studio setup
 * with the studio finish on: depth (baked occlusion) and the studio lights
 * baked into the model, and the map's compressed version, which is what a
 * published scene loads. `scripts/bake-hero-model.ts` bakes the hero file
 * from it, and the stage lights the file with it, so the map, the lights and
 * the bake agree.
 */
export const HERO_LIGHTING: LightingSettings = {
	...SOFT_STUDIO.lighting,
	environment: { ...SOFT_STUDIO.lighting.environment, quality: 'compressed' },
	occlusion: { mode: 'baked' },
	bake: { lights: true }
}

export const HERO_RESOLVED_LIGHTING = resolveLighting({
	lighting: HERO_LIGHTING
})
